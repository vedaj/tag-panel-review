'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { generateAllReport, generateProjectTypeReport, downloadBlob, type ProjectType, type ReportData } from '@/lib/excel'
import type { Group, Student, Profile, Criteria, Grade, Feedback } from '@/types/database'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { FileDown, Loader2, RefreshCw, BarChart3, Users, CheckCircle2, Microscope, AppWindow, Code2, Layers, Trash2, AlertTriangle } from 'lucide-react'

interface Stats {
  groups: Group[]
  students: Student[]
  faculty: Profile[]
  gradedCount: number
}

type DownloadKey = ProjectType | 'all'

const TYPE_OPTIONS: { key: ProjectType; label: string; icon: React.ReactNode; color: string }[] = [
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
      supabase.from('grades').select('student_id').limit(10000),
    ])
    const gradedStudentIds = new Set(grades?.map((g: { student_id: string }) => g.student_id) ?? [])
    setStats({
      groups: groups ?? [],
      students: students ?? [],
      faculty: faculty ?? [],
      gradedCount: gradedStudentIds.size,
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
      setConfirmReset(false)
      if (stats) setStats({ ...stats, gradedCount: 0 })
    } finally {
      setResetting(false)
    }
  }

  const busy = downloading !== null

  return (
    <div className="p-6 md:p-8 pt-20 md:pt-8 max-w-3xl">
      <div className="mb-8">
        <p className="eyebrow mb-1">Admin</p>
        <h1 style={{ margin: 0, fontFamily: 'var(--title-font)', fontSize: '1.8rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)' }}>
          Grade Report
        </h1>
        <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.88rem', marginTop: 4 }}>
          Download grade reports for all projects or filtered by type. Each sheet includes 4 criteria (mean across faculty who graded), student comments, and group comments.
        </p>
      </div>

      <div className="space-y-6">
        {/* Stats */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 size={18} />
                Current Status
              </CardTitle>
              <Button variant="outline" size="sm" onClick={loadStats} disabled={loading} className="gap-1.5">
                {loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                {stats ? 'Refresh' : 'Load Stats'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {!stats && !loading && (
              <p className="text-sm text-muted-foreground">Click &quot;Load Stats&quot; to see current progress.</p>
            )}
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatCard label="Groups"          value={stats.groups.length}    icon={<Users size={18} />} />
                <StatCard label="Students"        value={stats.students.length}  icon={<Users size={18} />} />
                <StatCard label="Faculty"         value={stats.faculty.length}   icon={<Users size={18} />} />
                <StatCard label="Students Graded" value={stats.gradedCount}      icon={<CheckCircle2 size={18} />} highlight />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Overall download */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Layers size={18} />
              All Projects
            </CardTitle>
            <CardDescription>
              One file with three sheets — Research, Application, and Software — each with all groups of that type.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              size="lg"
              onClick={() => handleDownload('all')}
              disabled={busy}
              className="gap-2"
            >
              {downloading === 'all'
                ? <><Loader2 className="animate-spin" size={16} />Generating…</>
                : <><FileDown size={16} />Download All Projects</>}
            </Button>
          </CardContent>
        </Card>

        {/* Reset grades */}
        <Card style={{ borderColor: confirmReset ? 'hsl(0 72% 51% / 0.4)' : undefined }}>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-destructive">
              <Trash2 size={18} />
              Reset All Grades
            </CardTitle>
            <CardDescription>
              Permanently deletes all grade entries and all feedback comments for every student and group. This cannot be undone.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!confirmReset ? (
              <Button variant="destructive" className="gap-2" onClick={() => setConfirmReset(true)}>
                <Trash2 size={15} />
                Reset All Grades
              </Button>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '12px 14px', borderRadius: 8, background: 'hsl(0 72% 51% / 0.08)', border: '1px solid hsl(0 72% 51% / 0.25)' }}>
                  <AlertTriangle size={16} style={{ color: 'hsl(0 72% 51%)', marginTop: 1, flexShrink: 0 }} />
                  <p style={{ fontSize: '0.85rem', color: 'hsl(var(--foreground))', margin: 0 }}>
                    This will delete <strong>all grades and feedback</strong> for every student. Are you sure?
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
          </CardContent>
        </Card>

        {/* Per-type downloads */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileDown size={18} />
              Download by Project Type
            </CardTitle>
            <CardDescription>
              Individual file for each project type: group, title, guides, roll numbers, names, 4 criteria means, total, %, per-student comments, group comments.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-3">
              {TYPE_OPTIONS.map(({ key, label, icon, color }) => (
                <TypeButton
                  key={key}
                  label={label}
                  icon={icon}
                  color={color}
                  loading={downloading === key}
                  disabled={busy}
                  onClick={() => handleDownload(key)}
                />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function TypeButton({
  label, icon, color, loading, disabled, onClick,
}: {
  label: string; icon: React.ReactNode; color: string
  loading: boolean; disabled: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12,
        padding: '16px 18px', borderRadius: 10,
        border: '1.5px solid hsl(var(--border))',
        background: 'hsl(var(--card))',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled && !loading ? 0.5 : 1,
        transition: 'border-color 0.15s, box-shadow 0.15s',
      }}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.borderColor = color
          e.currentTarget.style.boxShadow = `0 0 0 3px ${color}22`
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'hsl(var(--border))'
        e.currentTarget.style.boxShadow = 'none'
      }}
    >
      <span style={{ color, display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
        {loading ? <Loader2 size={14} className="animate-spin" /> : icon}
        {label}
      </span>
      <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.83rem', color: 'hsl(var(--muted-foreground))' }}>
        <FileDown size={13} />
        {loading ? 'Generating…' : 'Download .xlsx'}
      </span>
    </button>
  )
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-4 ${highlight ? 'bg-primary/10 border border-primary/20' : 'bg-muted'}`}>
      <div className={`mb-2 ${highlight ? 'text-primary' : 'text-muted-foreground'}`}>{icon}</div>
      <p className={`text-2xl font-bold ${highlight ? 'text-primary' : ''}`}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}
