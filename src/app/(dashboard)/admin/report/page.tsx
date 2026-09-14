'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { generateAllReport, generateProjectTypeReport, generateAuditReport, downloadBlob, type ProjectType, type ReportData } from '@/lib/excel'
import type { Group, Student, Profile, Criteria, Grade, Feedback } from '@/types/database'
import { Button } from '@/components/ui/button'
import {
  FileDown, Loader2, RefreshCw, Users, CheckCircle2,
  Microscope, AppWindow, Code2, Layers, Trash2, AlertTriangle, ShieldCheck,
} from 'lucide-react'

type DownloadKey = ProjectType | 'all' | 'audit'

interface Stats {
  groups: Group[]
  students: Student[]
  faculty: Profile[]
  grades: { student_id: string }[]
}

const PROJECT_TYPES: { key: ProjectType; label: string; icon: React.ReactNode; color: string }[] = [
  { key: 'research',    label: 'Research Based',    icon: <Microscope size={14} />, color: 'hsl(220 80% 55%)' },
  { key: 'application', label: 'Application Based', icon: <AppWindow  size={14} />, color: 'hsl(160 60% 40%)' },
  { key: 'software',    label: 'Software Based',    icon: <Code2      size={14} />, color: 'hsl(270 60% 55%)' },
]

export default function ReportPage() {
  const supabase = createClient()
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(false)
  const [downloading, setDownloading] = useState<DownloadKey | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  async function loadStats() {
    setLoading(true)
    const [{ data: groups }, { data: students }, { data: faculty }, { data: grades }] = await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('students').select('*'),
      supabase.from('profiles').select('*'),
      supabase.from('grades').select('student_id').limit(50000),
    ])
    setStats({
      groups: groups ?? [],
      students: students ?? [],
      faculty: faculty ?? [],
      grades: grades ?? [],
    })
    setLoading(false)
  }

  async function fetchAll(): Promise<ReportData> {
    const [{ data: groups }, { data: students }, { data: faculty }, { data: criteria }, { data: grades }, { data: feedback }] =
      await Promise.all([
        supabase.from('groups').select('*').order('name'),
        supabase.from('students').select('*'),
        supabase.from('profiles').select('*'),
        supabase.from('criteria').select('*, sub_criteria(*)').order('order_index'),
        supabase.from('grades').select('*').limit(100000),
        supabase.from('feedback').select('*').limit(100000),
      ])
    const sortedCriteria = (criteria ?? []).map((c) => ({
      ...c,
      sub_criteria: (c.sub_criteria ?? []).sort(
        (a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index
      ),
    }))
    return {
      groups: groups ?? [],
      students: students ?? [],
      faculty: faculty ?? [],
      criteria: sortedCriteria,
      grades: grades ?? [],
      feedback: feedback ?? [],
    }
  }

  async function handleDownload(key: DownloadKey) {
    setDownloading(key)
    try {
      const data = await fetchAll()
      const date = new Date().toISOString().slice(0, 10)
      if (key === 'all') {
        downloadBlob(generateAllReport(data), `TAG_All_Projects_${date}.xlsx`)
      } else if (key === 'audit') {
        downloadBlob(generateAuditReport(data), `TAG_Audit_${date}.xlsx`)
      } else {
        downloadBlob(generateProjectTypeReport(data, key), `TAG_${key}_report_${date}.xlsx`)
      }
    } finally {
      setDownloading(null)
    }
  }

  async function handleResetGrades() {
    setResetting(true)
    try {
      await supabase.from('grades').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('feedback').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      await supabase.from('groups').update({ project_type: null }).neq('id', '00000000-0000-0000-0000-000000000000')
      setConfirmReset(false)
      if (stats) setStats({ ...stats, grades: [] })
    } finally {
      setResetting(false)
    }
  }

  // Per-type breakdown
  const gradedIds = new Set(stats?.grades.map((g) => g.student_id) ?? [])

  function typeRow(type: ProjectType | null) {
    if (!stats) return null
    const groups = type ? stats.groups.filter((g) => g.project_type === type) : stats.groups
    const students = type
      ? stats.students.filter((s) => groups.some((g) => g.id === s.group_id))
      : stats.students
    const graded = students.filter((s) => gradedIds.has(s.id)).length
    const pct = students.length > 0 ? Math.round((graded / students.length) * 100) : 0
    return { groups: groups.length, students: students.length, graded, pct }
  }

  const busy = downloading !== null

  return (
    <div className="p-6 md:p-8 pt-20 md:pt-8" style={{ maxWidth: 780 }}>
      {/* Page header */}
      <div style={{ marginBottom: 28 }}>
        <p className="eyebrow" style={{ marginBottom: 4 }}>Admin</p>
        <h1 style={{ margin: 0, fontFamily: 'var(--title-font)', fontSize: '1.9rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)', lineHeight: 1.1 }}>
          Grade Report
        </h1>
        <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.88rem', marginTop: 6 }}>
          Monitor grading progress and export results by project type.
        </p>
      </div>

      <div style={{ display: 'grid', gap: 20 }}>

        {/* ── Progress stats ── */}
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'calc(var(--radius) * 1.6)', overflow: 'hidden', background: 'hsl(var(--card))', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="card-header-slate">
            <span className="card-header-slate-title">
              <CheckCircle2 size={15} style={{ color: 'var(--brand-600)' }} />
              Grading Progress
            </span>
            <button
              onClick={loadStats}
              disabled={loading}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 'calc(var(--radius) * 1.2)',
                border: '1px solid hsl(var(--border))', background: 'white',
                fontSize: '0.78rem', fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
                color: '#475569', transition: 'background 0.12s',
              }}
            >
              {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
              {stats ? 'Refresh' : 'Load Stats'}
            </button>
          </div>

          {!stats ? (
            <div style={{ padding: '28px 20px', color: 'hsl(var(--muted-foreground))', fontSize: '0.84rem', textAlign: 'center' }}>
              Click &ldquo;Load Stats&rdquo; to see current grading progress.
            </div>
          ) : (
            <table className="progress-table">
              <thead>
                <tr>
                  <th>Project Type</th>
                  <th>Groups</th>
                  <th>Students</th>
                  <th>Graded</th>
                  <th>Progress</th>
                </tr>
              </thead>
              <tbody>
                {PROJECT_TYPES.map(({ key, label, icon, color }) => {
                  const row = typeRow(key)
                  if (!row) return null
                  const pillBg = row.pct === 100 ? '#dcfce7' : row.pct >= 50 ? '#fef9c3' : '#fee2e2'
                  const pillColor = row.pct === 100 ? '#166534' : row.pct >= 50 ? '#854d0e' : '#991b1b'
                  return (
                    <tr key={key}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, color, fontWeight: 600 }}>
                          {icon}{label}
                        </span>
                      </td>
                      <td>{row.groups}</td>
                      <td>{row.students}</td>
                      <td>{row.graded} / {row.students}</td>
                      <td>
                        <span className="pct-pill" style={{ background: pillBg, color: pillColor }}>
                          {row.pct}%
                        </span>
                      </td>
                    </tr>
                  )
                })}
                {(() => {
                  const all = typeRow(null)
                  if (!all) return null
                  const pillBg = all.pct === 100 ? '#dcfce7' : all.pct >= 50 ? '#fef9c3' : '#fee2e2'
                  const pillColor = all.pct === 100 ? '#166534' : all.pct >= 50 ? '#854d0e' : '#991b1b'
                  return (
                    <tr style={{ fontWeight: 700, background: '#f8fafc' }}>
                      <td>
                        <span style={{ display: 'flex', alignItems: 'center', gap: 7, color: '#334155', fontWeight: 700 }}>
                          <Users size={14} />All Types
                        </span>
                      </td>
                      <td>{all.groups}</td>
                      <td>{all.students}</td>
                      <td>{all.graded} / {all.students}</td>
                      <td>
                        <span className="pct-pill" style={{ background: pillBg, color: pillColor }}>
                          {all.pct}%
                        </span>
                      </td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          )}
        </div>

        {/* ── Download all ── */}
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'calc(var(--radius) * 1.6)', overflow: 'hidden', background: 'hsl(var(--card))', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="card-header-slate">
            <span className="card-header-slate-title">
              <Layers size={15} style={{ color: 'var(--brand-600)' }} />
              Complete Report
            </span>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'hsl(var(--muted-foreground))' }}>
              One file with three sheets — Research, Application, and Software — each containing all groups of that type with criteria scores, student comments, and group comments.
            </p>
            <button
              onClick={() => handleDownload('all')}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 'calc(var(--radius) * 1.2)',
                border: 0, background: 'var(--brand-600)', color: 'white',
                fontWeight: 600, fontSize: '0.88rem', cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy && downloading !== 'all' ? 0.5 : 1,
                boxShadow: '0 4px 14px -6px var(--brand-600)',
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'opacity 0.12s, transform 0.12s',
              }}
              onMouseEnter={(e) => { if (!busy) e.currentTarget.style.transform = 'translateY(-1px)' }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = '' }}
            >
              {downloading === 'all'
                ? <><Loader2 size={14} className="animate-spin" />Generating…</>
                : <><FileDown size={14} />Download All</>}
            </button>
          </div>
        </div>

        {/* ── Per-type downloads ── */}
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'calc(var(--radius) * 1.6)', overflow: 'hidden', background: 'hsl(var(--card))', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="card-header-slate">
            <span className="card-header-slate-title">
              <FileDown size={15} style={{ color: 'var(--brand-600)' }} />
              Download by Project Type
            </span>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <p style={{ margin: '0 0 14px', fontSize: '0.83rem', color: 'hsl(var(--muted-foreground))' }}>
              Group, title, guides, roll numbers, 4 criteria means, total, %, per-student comments, and group comments.
            </p>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
              {PROJECT_TYPES.map(({ key, label, icon, color }) => (
                <button
                  key={key}
                  onClick={() => handleDownload(key)}
                  disabled={busy}
                  className="download-card"
                  style={{ opacity: busy && downloading !== key ? 0.5 : 1 }}
                >
                  <span className="download-card-label" style={{ color }}>
                    {downloading === key ? <Loader2 size={13} className="animate-spin" /> : icon}
                    {label}
                  </span>
                  <span className="download-card-sub">
                    <FileDown size={12} />
                    {downloading === key ? 'Generating…' : 'Download .xlsx'}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ── Audit report ── */}
        <div style={{ border: '1px solid hsl(var(--border))', borderRadius: 'calc(var(--radius) * 1.6)', overflow: 'hidden', background: 'hsl(var(--card))', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
          <div className="card-header-slate">
            <span className="card-header-slate-title">
              <ShieldCheck size={15} style={{ color: 'var(--brand-600)' }} />
              Audit Report
            </span>
          </div>
          <div style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            <p style={{ margin: 0, fontSize: '0.84rem', color: 'hsl(var(--muted-foreground))' }}>
              One row per student per faculty — shows exactly which marks each evaluator awarded, for cross-checking and moderation. Confidential admin-only export.
            </p>
            <button
              onClick={() => handleDownload('audit')}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                padding: '9px 18px', borderRadius: 'calc(var(--radius) * 1.2)',
                border: `1.5px solid ${downloading === 'audit' ? 'var(--brand-600)' : 'hsl(var(--border))'}`,
                background: 'hsl(var(--card))', color: downloading === 'audit' ? 'var(--brand-600)' : 'hsl(var(--foreground))',
                fontWeight: 600, fontSize: '0.88rem', cursor: busy ? 'not-allowed' : 'pointer',
                opacity: busy && downloading !== 'audit' ? 0.5 : 1,
                whiteSpace: 'nowrap', flexShrink: 0,
                transition: 'opacity 0.12s, border-color 0.12s',
              }}
            >
              {downloading === 'audit'
                ? <><Loader2 size={14} className="animate-spin" />Generating…</>
                : <><FileDown size={14} />Download Audit</>}
            </button>
          </div>
        </div>

        {/* ── Reset grades ── */}
        <div style={{ border: confirmReset ? '1px solid hsl(0 84% 60% / 0.35)' : '1px solid hsl(var(--border))', borderRadius: 'calc(var(--radius) * 1.6)', overflow: 'hidden', background: 'hsl(var(--card))', boxShadow: '0 1px 4px rgba(0,0,0,0.06)', transition: 'border-color 0.2s' }}>
          <div className="card-header-slate" style={{ background: confirmReset ? '#fff5f5' : undefined }}>
            <span className="card-header-slate-title" style={{ color: '#dc2626' }}>
              <Trash2 size={15} />
              Reset All Grades
            </span>
          </div>
          <div style={{ padding: '18px 20px' }}>
            {!confirmReset ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
                <p style={{ margin: 0, fontSize: '0.84rem', color: 'hsl(var(--muted-foreground))' }}>
                  Permanently deletes all grade entries and feedback comments for every student, and clears the project type on every group. This cannot be undone.
                </p>
                <Button variant="destructive" className="gap-2" onClick={() => setConfirmReset(true)} style={{ flexShrink: 0 }}>
                  <Trash2 size={14} />Reset All Grades
                </Button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '11px 14px', borderRadius: 'calc(var(--radius) * 1.2)', background: '#fff5f5', border: '1px solid #fecaca' }}>
                  <AlertTriangle size={15} style={{ color: '#dc2626', marginTop: 1, flexShrink: 0 }} />
                  <p style={{ margin: 0, fontSize: '0.84rem', color: '#7f1d1d' }}>
                    This will delete <strong>all grades and feedback</strong> for every student and group, and <strong>clear the project type</strong> on every group. Are you absolutely sure?
                  </p>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="destructive" className="gap-2" onClick={handleResetGrades} disabled={resetting}>
                    {resetting ? <><Loader2 size={14} className="animate-spin" />Deleting…</> : <>Yes, delete everything</>}
                  </Button>
                  <Button variant="outline" onClick={() => setConfirmReset(false)} disabled={resetting}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
