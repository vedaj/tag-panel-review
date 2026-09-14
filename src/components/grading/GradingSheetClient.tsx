'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { gradeKey, feedbackKey } from '@/lib/utils'
import type { Group, Student, Criteria, SubCriteria, Grade, Feedback, GradeMap, FeedbackMap, ProjectType } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Separator } from '@/components/ui/separator'
import {
  ArrowLeft, Save, Users, MessageSquare, CheckCircle2, Loader2, Info, X,
  FlaskConical, Smartphone, Code2, Trash2, AlertTriangle, Lock,
} from 'lucide-react'
import Link from 'next/link'

interface Props {
  group: Group & { students: Student[] }
  criteria: (Criteria & { sub_criteria: SubCriteria[] })[]
  existingGrades: Grade[]
  existingFeedback: Feedback[]
  facultyId: string
  isAdmin: boolean
}

const PROJECT_TYPES: { value: ProjectType; label: string; description: string; Icon: React.ElementType }[] = [
  { value: 'research',     label: 'Research Based',     description: 'Literature survey, analysis & novel findings', Icon: FlaskConical },
  { value: 'application',  label: 'Application Based',  description: 'App development solving a real-world problem',  Icon: Smartphone  },
  { value: 'software',     label: 'Software Based',     description: 'Full software system with architecture & modules', Icon: Code2    },
]

type GradeCol = {
  key: string
  critId: string
  critTitle: string
  critDesc: string
  subId: string | null
  subTitle: string | null
  subDesc: string | null
  max: number
  allowedMarks: string
}

function toTitleCase(name: string) {
  return name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

export function GradingSheetClient({ group, criteria, existingGrades, existingFeedback, facultyId, isAdmin }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const buildGradeMap = (): GradeMap => {
    const map: GradeMap = {}
    for (const g of existingGrades) map[gradeKey(g.student_id, g.criteria_id, g.sub_criteria_id)] = g.marks
    return map
  }
  const buildFeedbackMap = (): FeedbackMap => {
    const map: FeedbackMap = {}
    for (const f of existingFeedback) map[feedbackKey(f.group_id, f.student_id)] = f.content
    return map
  }

  const [projectType, setProjectTypeState] = useState<ProjectType>(group.project_type ?? '')
  const [grades, setGrades] = useState<GradeMap>(buildGradeMap)
  const [feedbacks, setFeedbacks] = useState<FeedbackMap>(buildFeedbackMap)
  const [showFeedback, setShowFeedback] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [settingType, setSettingType] = useState(false)
  const [rubricPopup, setRubricPopup] = useState<{ title: string; text: string } | null>(null)
  const [confirmReset, setConfirmReset] = useState(false)
  const [resetting, setResetting] = useState(false)

  const students = group.students

  async function selectProjectType(type: ProjectType) {
    setSettingType(true)
    await supabase.from('groups').update({ project_type: type }).eq('id', group.id)
    setProjectTypeState(type)
    setSettingType(false)
  }

  const visibleCriteria = projectType
    ? criteria.filter((c) => c.project_type === projectType || c.project_type === 'all')
    : criteria

  function getGrade(studentId: string, criteriaId: string, subId: string | null): number {
    return grades[gradeKey(studentId, criteriaId, subId)] ?? 0
  }
  function setGrade(studentId: string, criteriaId: string, subId: string | null, value: number) {
    setGrades((prev) => ({ ...prev, [gradeKey(studentId, criteriaId, subId)]: value }))
    setSaved(false)
  }
  function applyColToAll(col: GradeCol) {
    if (students.length === 0) return
    const first = getGrade(students[0].id, col.critId, col.subId)
    setGrades((prev) => {
      const next = { ...prev }
      for (const s of students) next[gradeKey(s.id, col.critId, col.subId)] = first
      return next
    })
    setSaved(false)
  }

  function studentTotal(studentId: string): number {
    let total = 0
    for (const crit of visibleCriteria) {
      if (crit.sub_criteria.length > 0) {
        for (const sub of crit.sub_criteria) total += getGrade(studentId, crit.id, sub.id)
      } else {
        total += getGrade(studentId, crit.id, null)
      }
    }
    return total
  }
  function maxMarks(): number {
    return visibleCriteria.reduce((sum, c) => sum + c.max_marks, 0)
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const gradeRows = []
      for (const student of students) {
        for (const crit of visibleCriteria) {
          if (crit.sub_criteria.length > 0) {
            for (const sub of crit.sub_criteria) {
              gradeRows.push({ faculty_id: facultyId, student_id: student.id, criteria_id: crit.id, sub_criteria_id: sub.id, marks: getGrade(student.id, crit.id, sub.id) })
            }
          } else {
            gradeRows.push({ faculty_id: facultyId, student_id: student.id, criteria_id: crit.id, sub_criteria_id: null, marks: getGrade(student.id, crit.id, null) })
          }
        }
      }
      const { error: gradesErr } = await supabase.from('grades').upsert(gradeRows, { onConflict: 'faculty_id,student_id,criteria_id,sub_criteria_id' })
      if (gradesErr) throw gradesErr

      const feedbackRows = []
      const groupFb = feedbacks[feedbackKey(group.id, null)]
      if (groupFb !== undefined) feedbackRows.push({ faculty_id: facultyId, group_id: group.id, student_id: null, content: groupFb })
      for (const student of students) {
        const fb = feedbacks[feedbackKey(group.id, student.id)]
        if (fb !== undefined) feedbackRows.push({ faculty_id: facultyId, group_id: group.id, student_id: student.id, content: fb })
      }
      if (feedbackRows.length > 0) {
        const { error: fbErr } = await supabase.from('feedback').upsert(feedbackRows, { onConflict: 'faculty_id,group_id,student_id' })
        if (fbErr) throw fbErr
      }

      setSaved(true)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleResetMarks() {
    setResetting(true)
    try {
      const studentIds = students.map((s) => s.id)
      if (studentIds.length > 0) {
        await supabase.from('grades')
          .delete()
          .eq('faculty_id', facultyId)
          .in('student_id', studentIds)
      }
      await supabase.from('feedback')
        .delete()
        .eq('faculty_id', facultyId)
        .eq('group_id', group.id)
      await supabase.from('groups').update({ project_type: null }).eq('id', group.id)
      setGrades({})
      setFeedbacks({})
      setProjectTypeState('')
      setSaved(false)
      setConfirmReset(false)
    } finally {
      setResetting(false)
    }
  }

  const gradeColumns: GradeCol[] = useMemo(() => {
    const cols: GradeCol[] = []
    for (const crit of visibleCriteria) {
      if (crit.sub_criteria.length > 0) {
        for (const sub of crit.sub_criteria) {
          cols.push({
            key: `${crit.id}:${sub.id}`,
            critId: crit.id, critTitle: crit.title, critDesc: crit.description,
            subId: sub.id, subTitle: sub.title, subDesc: sub.description,
            max: sub.max_marks, allowedMarks: sub.allowed_marks,
          })
        }
      } else {
        cols.push({
          key: crit.id,
          critId: crit.id, critTitle: crit.title, critDesc: crit.description,
          subId: null, subTitle: null, subDesc: null,
          max: crit.max_marks, allowedMarks: crit.allowed_marks,
        })
      }
    }
    return cols
  }, [visibleCriteria])

  const critGroups = useMemo(() => {
    const groups: { critId: string; critTitle: string; critDesc: string; count: number; hasSub: boolean }[] = []
    for (const col of gradeColumns) {
      const last = groups[groups.length - 1]
      if (last && last.critId === col.critId) {
        last.count++
      } else {
        groups.push({ critId: col.critId, critTitle: col.critTitle, critDesc: col.critDesc, count: 1, hasSub: col.subId !== null })
      }
    }
    return groups
  }, [gradeColumns])

  const hasAnySub = critGroups.some((g) => g.hasSub)
  const maxTotal = maxMarks()
  const selectedTypeInfo = PROJECT_TYPES.find((t) => t.value === projectType)

  // ── Project type gate ────────────────────────────────────────────────────
  if (!projectType) {
    return (
      <div className="min-h-screen bg-background md:pt-0 pt-14 flex items-start justify-center">
        <div className="w-full max-w-2xl px-4 md:px-8 py-10">
          <Link href="/dashboard" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-8">
            <ArrowLeft size={16} /> Back to Dashboard
          </Link>
          <div className="mb-6">
            <h1 className="text-2xl font-bold">{group.name}</h1>
            {group.project_title && <p className="text-muted-foreground mt-1">{group.project_title}</p>}
          </div>

          {isAdmin ? (
            /* Admin: show the type selector */
            <div style={{
              padding: '24px',
              border: '1px solid var(--app-panel-border)',
              borderRadius: '20px',
              background: 'linear-gradient(180deg, var(--app-panel-strong), var(--app-panel))',
            }}>
              <p className="eyebrow mb-2">Step 1</p>
              <h2 style={{ margin: '0 0 4px', fontFamily: 'var(--title-font)', fontSize: '1.4rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)' }}>
                Select Project Type
              </h2>
              <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.88rem', marginBottom: '20px' }}>
                Choose the category that best describes this group&apos;s project. This determines which rubric criteria are shown.
              </p>
              <div style={{ display: 'grid', gap: '12px' }}>
                {PROJECT_TYPES.map(({ value, label, description, Icon }) => (
                  <button
                    key={value}
                    disabled={settingType}
                    onClick={() => selectProjectType(value)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '16px',
                      padding: '16px 20px', borderRadius: '14px',
                      border: '1px solid var(--app-panel-border)',
                      background: 'var(--app-panel-strong)',
                      cursor: settingType ? 'wait' : 'pointer',
                      textAlign: 'left',
                      transition: 'border-color 140ms ease, transform 140ms ease',
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'hsl(var(--primary))'; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)' }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--app-panel-border)'; (e.currentTarget as HTMLButtonElement).style.transform = 'none' }}
                  >
                    <span style={{
                      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                      width: 44, height: 44, borderRadius: '12px',
                      background: 'var(--app-accent-soft)', color: 'var(--app-kicker)',
                      flexShrink: 0,
                    }}>
                      <Icon size={20} />
                    </span>
                    <span>
                      <span style={{ display: 'block', fontWeight: 600, color: 'var(--app-hero-text)' }}>{label}</span>
                      <span style={{ display: 'block', fontSize: '0.82rem', color: 'var(--app-hero-subtext)', marginTop: 2 }}>{description}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            /* Non-admin: inform and block */
            <div style={{
              padding: '32px 28px',
              border: '1px solid var(--app-panel-border)',
              borderRadius: '20px',
              background: 'linear-gradient(180deg, var(--app-panel-strong), var(--app-panel))',
              textAlign: 'center',
            }}>
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 52, height: 52, borderRadius: '14px',
                background: 'var(--app-accent-soft)', color: 'var(--app-kicker)',
                marginBottom: 16,
              }}>
                <Lock size={22} />
              </span>
              <h2 style={{ margin: '0 0 8px', fontFamily: 'var(--title-font)', fontSize: '1.3rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)' }}>
                Project Type Not Set
              </h2>
              <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.9rem', lineHeight: 1.6, maxWidth: 360, margin: '0 auto' }}>
                The project type for <strong>{group.name}</strong> hasn&apos;t been set yet. Please ask your admin to assign a project type before you can begin grading.
              </p>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── Shared cell styles ────────────────────────────────────────────────────
  // Roll No: first sticky col (left: 0)
  // Student name: second sticky col (left: ROLL_W)
  const ROLL_W = 72
  const ROLL_PREFIX = 'CB.SC.U4CSE'
  const shortRoll = (r: string) => r.startsWith(ROLL_PREFIX) ? r.slice(ROLL_PREFIX.length) : r

  const thBase: React.CSSProperties = {
    padding: '10px 12px',
    textAlign: 'center',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--app-hero-subtext)',
    background: 'hsl(var(--muted))',
    borderBottom: '2px solid hsl(var(--border))',
    borderRight: '1px solid hsl(var(--border) / 0.5)',
    whiteSpace: 'normal',
    lineHeight: 1.3,
    maxWidth: 160,
  }
  const stickyRollTh: React.CSSProperties = {
    ...thBase,
    position: 'sticky',
    left: 0,
    zIndex: 3,
    minWidth: ROLL_W,
    textAlign: 'left',
    borderRight: '2px solid hsl(var(--border))',
  }
  const stickyNameTh: React.CSSProperties = {
    ...thBase,
    position: 'sticky',
    left: ROLL_W,
    zIndex: 3,
    minWidth: 110,
    textAlign: 'left',
    borderRight: '2px solid hsl(var(--border))',
  }
  const tdBase: React.CSSProperties = {
    padding: '8px 10px',
    textAlign: 'center',
    verticalAlign: 'middle',
    borderBottom: '1px solid hsl(var(--border) / 0.4)',
    borderRight: '1px solid hsl(var(--border) / 0.25)',
  }
  const stickyRollTd = (bg: string): React.CSSProperties => ({
    ...tdBase,
    position: 'sticky',
    left: 0,
    zIndex: 2,
    textAlign: 'left',
    fontSize: '0.75rem',
    fontWeight: 500,
    letterSpacing: '0.01em',
    color: 'hsl(var(--foreground))',
    background: bg,
    borderRight: '2px solid hsl(var(--border))',
  })
  const stickyNameTd = (bg: string): React.CSSProperties => ({
    ...tdBase,
    position: 'sticky',
    left: ROLL_W,
    zIndex: 2,
    textAlign: 'left',
    fontWeight: 500,
    fontSize: '0.85rem',
    background: bg,
    borderRight: '2px solid hsl(var(--border))',
  })

  // ── Main grading sheet ───────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-background md:pt-0 pt-14">
      {/* Sticky header bar */}
      <div className="sticky top-0 z-10 bg-card border-b px-4 md:px-6 py-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Link href="/dashboard">
              <Button variant="ghost" size="icon" className="flex-shrink-0 h-9 w-9">
                <ArrowLeft size={18} />
              </Button>
            </Link>
            <div className="min-w-0">
              <h1 className="font-bold text-sm md:text-base truncate leading-tight">{group.name}</h1>
              {group.project_title && <p className="text-xs text-muted-foreground truncate">{group.project_title}</p>}
            </div>
            {selectedTypeInfo && (
              <button
                onClick={() => setProjectTypeState('')}
                title="Change project type"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 9px', borderRadius: '999px',
                  background: 'var(--app-accent-soft)', color: 'var(--app-kicker)',
                  border: '1px solid hsl(var(--primary) / 0.2)',
                  fontSize: '0.72rem', fontWeight: 600, cursor: 'pointer', flexShrink: 0,
                  touchAction: 'manipulation',
                }}
              >
                <selectedTypeInfo.Icon size={12} />
                {selectedTypeInfo.label}
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowFeedback(!showFeedback)} className="gap-1.5 hidden sm:flex">
              <MessageSquare size={14} /> Feedback
            </Button>
            <Button
              variant="outline" size="sm"
              onClick={() => setConfirmReset((v) => !v)}
              className="gap-1.5 text-destructive hover:text-destructive border-destructive/30 hover:bg-destructive/10"
              title="Reset my marks for this group"
            >
              <Trash2 size={14} /> Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving || resetting} className="gap-1.5">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</>
               : saved ? <><CheckCircle2 size={14} />Saved</>
               : <><Save size={14} />Save</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-3 md:px-6 py-4 space-y-5">
        {/* Group meta */}
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users size={14} />{students.length} student{students.length !== 1 ? 's' : ''}</span>
          {group.guide1 && <span>Guide: <strong className="text-foreground">{group.guide1}{group.guide2 ? `, ${group.guide2}` : ''}</strong></span>}
        </div>

        {confirmReset && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderRadius: 'calc(var(--radius) * 1.4)', background: '#fff5f5', border: '1px solid #fecaca' }}>
            <AlertTriangle size={16} style={{ color: '#dc2626', marginTop: 1, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#7f1d1d', fontWeight: 500 }}>
                This will delete <strong>your grades and feedback</strong> for this group. Other faculty&apos;s marks are unaffected.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button variant="destructive" size="sm" className="gap-1.5" onClick={handleResetMarks} disabled={resetting}>
                  {resetting ? <><Loader2 size={13} className="animate-spin" />Resetting…</> : <>Yes, reset my marks</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmReset(false)} disabled={resetting}>
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>}

        {/* Grade table */}
        {visibleCriteria.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <Info size={32} className="mx-auto mb-3 opacity-40" />
              <p>No criteria found for the selected project type.</p>
              <p className="text-sm">Ask an admin to configure rubrics for this project type.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="overflow-hidden">
            {/* overflow-x scroll with momentum on iOS */}
            <div style={{ overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
              <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 360 }}>
                <thead>
                  {/* Row 1 — Roll No | Student | criterion group headers | Total */}
                  <tr>
                    <th style={stickyRollTh} rowSpan={hasAnySub ? 2 : 1}>Roll No.</th>
                    <th style={stickyNameTh} rowSpan={hasAnySub ? 2 : 1}>Student</th>
                    {critGroups.map((g) => (
                      <th
                        key={g.critId}
                        colSpan={g.hasSub ? g.count : 1}
                        rowSpan={!g.hasSub && hasAnySub ? 2 : 1}
                        style={{
                          ...thBase,
                          borderBottom: g.hasSub ? '1px solid hsl(var(--border) / 0.5)' : '2px solid hsl(var(--border))',
                          verticalAlign: 'middle',
                          minWidth: 140,
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                          <span style={{ color: 'var(--app-hero-text)' }}>{g.critTitle}</span>
                          {g.critDesc && (
                            <button
                              onClick={() => setRubricPopup({ title: g.critTitle, text: g.critDesc })}
                              title="View rubric"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--primary))', padding: 0, lineHeight: 1, touchAction: 'manipulation' }}
                            >
                              <Info size={13} />
                            </button>
                          )}
                        </div>
                      </th>
                    ))}
                    <th style={{ ...thBase, borderBottom: '2px solid hsl(var(--border))', minWidth: 64 }} rowSpan={hasAnySub ? 2 : 1}>
                      Total
                    </th>
                  </tr>

                  {/* Row 2 — sub-criterion headers */}
                  {hasAnySub && (
                    <tr>
                      {gradeColumns.map((col) => {
                        if (col.subId === null) return null
                        return (
                          <th key={col.key} style={{ ...thBase, fontSize: '0.68rem', fontWeight: 500, minWidth: 140 }}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                              <span>{col.subTitle}</span>
                              {col.subDesc && (
                                <button
                                  onClick={() => setRubricPopup({ title: col.subTitle!, text: col.subDesc! })}
                                  title="View rubric"
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--primary))', padding: 0, lineHeight: 1, touchAction: 'manipulation' }}
                                >
                                  <Info size={11} />
                                </button>
                              )}
                            </div>
                            <div style={{ color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{col.max} mk</div>
                            <button
                              onClick={() => applyColToAll(col)}
                              title="Copy first student's mark to all"
                              style={{ marginTop: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))', fontSize: '0.6rem', display: 'flex', alignItems: 'center', gap: 2, margin: '3px auto 0', touchAction: 'manipulation' }}
                            >
                              copy all
                            </button>
                          </th>
                        )
                      })}
                    </tr>
                  )}
                </thead>

                <tbody>
                  {students.map((student, si) => {
                    const rowBg = si % 2 === 0 ? 'hsl(var(--card))' : 'hsl(var(--muted) / 0.35)'
                    const tc = toTitleCase(student.name)
                    const displayName = tc.length > 12 ? tc.slice(0, 12) + '…' : tc
                    return (
                      <tr key={student.id} style={{ background: rowBg }}>
                        <td style={stickyRollTd(rowBg)} title={student.roll_number}>{shortRoll(student.roll_number)}</td>
                        <td
                          style={stickyNameTd(rowBg)}
                          title={tc.length > 12 ? tc : undefined}
                        >
                          {displayName}
                        </td>
                        {gradeColumns.map((col) => (
                          <td key={col.key} style={tdBase}>
                            <GradeInput
                              value={getGrade(student.id, col.critId, col.subId)}
                              max={col.max}
                              allowedMarks={col.allowedMarks}
                              onChange={(v) => setGrade(student.id, col.critId, col.subId, v)}
                            />
                          </td>
                        ))}
                        <td style={{ ...tdBase, fontWeight: 700, fontSize: '0.95rem', color: 'hsl(var(--primary))' }}>
                          {studentTotal(student.id).toFixed(1)}
                          <span style={{ display: 'block', fontSize: '0.65rem', fontWeight: 400, color: 'var(--app-hero-subtext)' }}>/{maxTotal}</span>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>

                <tfoot>
                  <tr style={{ borderTop: '2px solid hsl(var(--border))' }}>
                    <td
                      colSpan={2}
                      style={{
                        ...tdBase,
                        position: 'sticky', left: 0, zIndex: 2,
                        background: 'hsl(var(--muted))',
                        fontWeight: 600, fontSize: '0.75rem',
                        color: 'var(--app-hero-subtext)',
                        textAlign: 'left',
                        borderRight: '2px solid hsl(var(--border))',
                      }}
                    >
                      Max Marks
                    </td>
                    {gradeColumns.map((col) => (
                      <td key={col.key} style={{ ...tdBase, background: 'hsl(var(--muted))', fontSize: '0.78rem', fontWeight: 600, color: 'var(--app-hero-subtext)' }}>
                        {col.max}
                      </td>
                    ))}
                    <td style={{ ...tdBase, background: 'hsl(var(--muted))', fontWeight: 700, fontSize: '0.85rem', color: 'hsl(var(--primary))' }}>
                      {maxTotal}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        )}

        {/* Feedback */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare size={18} /> Feedback
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setShowFeedback(!showFeedback)}>
                {showFeedback ? '▾' : '▸'}
              </Button>
            </div>
          </CardHeader>
          {showFeedback && (
            <CardContent className="space-y-6">
              <div>
                <label className="text-sm font-medium mb-2 block">Group Feedback</label>
                <Textarea
                  placeholder="Overall feedback for the group / project…"
                  value={feedbacks[feedbackKey(group.id, null)] ?? ''}
                  onChange={(e) => { setFeedbacks((prev) => ({ ...prev, [feedbackKey(group.id, null)]: e.target.value })); setSaved(false) }}
                  rows={3}
                />
              </div>
              <Separator />
              <div className="space-y-4">
                <p className="text-sm font-medium">Individual Student Feedback</p>
                {students.map((s) => (
                  <div key={s.id}>
                    <label className="text-sm text-muted-foreground mb-1.5 block">
                      {toTitleCase(s.name)} <span className="text-xs" title={s.roll_number}>({shortRoll(s.roll_number)})</span>
                    </label>
                    <Textarea
                      placeholder={`Feedback for ${toTitleCase(s.name).split(' ')[0]}…`}
                      value={feedbacks[feedbackKey(group.id, s.id)] ?? ''}
                      onChange={(e) => { setFeedbacks((prev) => ({ ...prev, [feedbackKey(group.id, s.id)]: e.target.value })); setSaved(false) }}
                      rows={2}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          )}
        </Card>

        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={handleSave} disabled={saving} className="gap-2 min-w-[140px]">
            {saving ? <><Loader2 className="animate-spin" size={16} />Saving…</>
             : saved ? <><CheckCircle2 size={16} />Saved!</>
             : <><Save size={16} />Save Grades</>}
          </Button>
        </div>
      </div>

      {/* Rubric popup */}
      {rubricPopup && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(2px)', padding: '16px' }}
          onClick={() => setRubricPopup(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: 'var(--app-panel-strong)',
              border: '1px solid var(--app-panel-border)',
              borderRadius: 20,
              padding: '24px 28px',
              maxWidth: 500,
              width: '100%',
              boxShadow: '0 24px 64px rgba(0,0,0,0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 14 }}>
              <div>
                <p style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--app-kicker)', marginBottom: 4 }}>Rubric</p>
                <h3 style={{ margin: 0, fontFamily: 'var(--title-font)', fontSize: '1.2rem', letterSpacing: '-0.02em', color: 'var(--app-hero-text)', lineHeight: 1.25 }}>
                  {rubricPopup.title}
                </h3>
              </div>
              <button
                onClick={() => setRubricPopup(null)}
                style={{ background: 'hsl(var(--muted))', border: 'none', borderRadius: 8, padding: '6px', cursor: 'pointer', color: 'var(--app-hero-subtext)', flexShrink: 0, touchAction: 'manipulation' }}
              >
                <X size={16} />
              </button>
            </div>
            <p style={{ margin: 0, fontSize: '0.88rem', lineHeight: 1.65, color: 'var(--app-hero-subtext)' }}>
              {rubricPopup.text}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Grade input — always radio pills ──────────────────────────────────────
function generateOptions(max: number): number[] {
  if (max <= 10) return Array.from({ length: max + 1 }, (_, i) => i)
  if (max <= 20) {
    const opts: number[] = []
    for (let i = 0; i <= max; i += 2) opts.push(i)
    if (opts[opts.length - 1] !== max) opts.push(max)
    return opts
  }
  const opts: number[] = []
  for (let i = 0; i <= max; i += 5) opts.push(i)
  if (opts[opts.length - 1] !== max) opts.push(max)
  return opts
}

function GradeInput({
  value, max, allowedMarks, onChange,
}: {
  value: number
  max: number
  allowedMarks: string
  onChange: (v: number) => void
}) {
  const options = allowedMarks
    ? allowedMarks.split(',').map((s) => parseFloat(s.trim())).filter((n) => !isNaN(n))
    : generateOptions(max)

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxWidth: 220 }}>
      {options.map((opt) => {
        const active = value === opt
        return (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            title={`${opt} / ${max}`}
            style={{
              minWidth: 32,
              height: 32,
              padding: '0 9px',
              borderRadius: '999px',
              border: `1.5px solid ${active ? 'hsl(var(--primary))' : 'hsl(var(--border))'}`,
              background: active ? 'hsl(var(--primary))' : 'hsl(var(--background))',
              color: active ? 'hsl(var(--primary-foreground))' : 'hsl(var(--foreground))',
              fontSize: '0.8rem',
              fontWeight: active ? 700 : 500,
              lineHeight: 1,
              cursor: 'pointer',
              transition: 'background 120ms ease, border-color 120ms ease, color 120ms ease',
              touchAction: 'manipulation',
              WebkitTapHighlightColor: 'transparent',
              boxShadow: active ? '0 2px 8px -3px hsl(var(--primary) / 0.45)' : 'none',
            } as React.CSSProperties}
          >
            {opt}
          </button>
        )
      })}
    </div>
  )
}
