'use client'
import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { gradeKey, feedbackKey } from '@/lib/utils'
import type { Group, Student, Criteria, SubCriteria, Grade, Feedback, GradeMap, FeedbackMap } from '@/types/database'
import { Button } from '@/components/ui/button'
import { ArrowLeft, Save, Users, MessageSquare, CheckCircle2, Loader2, ThumbsUp, AlertTriangle } from 'lucide-react'
import Link from 'next/link'
import { GradeTable } from './GradeTable'
import type { GradeCol, CritGroup } from './GradeTable'
import { FeedbackPanel } from './FeedbackPanel'
import { RubricPopup } from './RubricPopup'

interface Props {
  group: Group & { students: Student[] }
  criteria: (Criteria & { sub_criteria: SubCriteria[] })[]
  existingGrades: Grade[]
  existingFeedback: Feedback[]
  facultyId: string
}

export function GuideSheetClient({ group, criteria, existingGrades, existingFeedback, facultyId }: Props) {
  const supabase = createClient()
  const router = useRouter()

  const [grades, setGrades] = useState<GradeMap>(() => {
    const map: GradeMap = {}
    for (const g of existingGrades) map[gradeKey(g.student_id, g.criteria_id, g.sub_criteria_id)] = g.marks
    return map
  })
  const [feedbacks, setFeedbacks] = useState<FeedbackMap>(() => {
    const map: FeedbackMap = {}
    for (const f of existingFeedback) map[feedbackKey(f.group_id, f.student_id)] = f.content
    return map
  })
  const [showFeedback, setShowFeedback] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rubricPopup, setRubricPopup] = useState<{ title: string; text: string } | null>(null)
  const [approving, setApproving] = useState(false)
  const [approved, setApproved] = useState(group.guide_approval_status === 'approved')
  const [confirmApprove, setConfirmApprove] = useState(false)

  const students = group.students

  function getGrade(studentId: string, criteriaId: string, subId: string | null): number {
    return grades[gradeKey(studentId, criteriaId, subId)] ?? 0
  }
  function setGrade(studentId: string, criteriaId: string, subId: string | null, value: number) {
    setGrades((prev) => ({ ...prev, [gradeKey(studentId, criteriaId, subId)]: value }))
    setSaved(false)
  }

  function studentTotal(studentId: string): number {
    let total = 0
    for (const crit of criteria) {
      if (crit.sub_criteria.length > 0) {
        for (const sub of crit.sub_criteria) total += getGrade(studentId, crit.id, sub.id)
      } else {
        total += getGrade(studentId, crit.id, null)
      }
    }
    return total
  }

  const gradeColumns: GradeCol[] = useMemo(() => {
    const cols: GradeCol[] = []
    for (const crit of criteria) {
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
  }, [criteria])

  const critGroups: CritGroup[] = useMemo(() => {
    const groups: CritGroup[] = []
    for (const col of gradeColumns) {
      const last = groups[groups.length - 1]
      if (last && last.critId === col.critId) {
        last.count++
        last.max += col.max
      } else {
        groups.push({ critId: col.critId, critTitle: col.critTitle, critDesc: col.critDesc, count: 1, hasSub: col.subId !== null, max: col.max })
      }
    }
    return groups
  }, [gradeColumns])

  const maxTotal = useMemo(
    () => criteria.reduce((sum, c) => sum + c.max_marks, 0),
    [criteria]
  )

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

  async function handleSave() {
    setSaving(true)
    setError(null)
    try {
      const upsertRows: { faculty_id: string; student_id: string; criteria_id: string; sub_criteria_id: string | null; marks: number }[] = []

      for (const student of students) {
        for (const crit of criteria) {
          if (crit.sub_criteria.length > 0) {
            for (const sub of crit.sub_criteria) {
              const marks = getGrade(student.id, crit.id, sub.id)
              if (marks > 0) upsertRows.push({ faculty_id: facultyId, student_id: student.id, criteria_id: crit.id, sub_criteria_id: sub.id, marks })
            }
          } else {
            const marks = getGrade(student.id, crit.id, null)
            if (marks > 0) upsertRows.push({ faculty_id: facultyId, student_id: student.id, criteria_id: crit.id, sub_criteria_id: null, marks })
          }
        }
      }

      if (upsertRows.length > 0) {
        const { error: gradesErr } = await supabase
          .from('grades')
          .upsert(upsertRows, { onConflict: 'faculty_id,student_id,criteria_id,sub_criteria_id' })
        if (gradesErr) throw gradesErr
      }

      const studentIds = students.map((s) => s.id)
      if (studentIds.length > 0) {
        const upsertedKeys = new Set(
          upsertRows.map((r) => `${r.student_id}:${r.criteria_id}:${r.sub_criteria_id ?? 'null'}`)
        )
        const { data: existing } = await supabase
          .from('grades').select('id, student_id, criteria_id, sub_criteria_id')
          .eq('faculty_id', facultyId).in('student_id', studentIds)
        const staleIds = (existing ?? [])
          .filter((g) => !upsertedKeys.has(`${g.student_id}:${g.criteria_id}:${g.sub_criteria_id ?? 'null'}`))
          .map((g) => g.id)
        if (staleIds.length > 0) await supabase.from('grades').delete().in('id', staleIds)
      }

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

  async function handleApprove() {
    setApproving(true)
    setError(null)
    try {
      const res = await fetch('/api/guide/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ groupId: group.id }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Failed to approve')
      setApproved(true)
      setConfirmApprove(false)
      router.refresh()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to approve')
    } finally {
      setApproving(false)
    }
  }

  return (
    <div className="min-h-screen bg-background md:pt-0 pt-14">
      {/* Sticky header */}
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
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '4px 9px', borderRadius: '999px',
              background: 'hsl(var(--primary) / 0.08)', color: 'hsl(var(--primary))',
              border: '1px solid hsl(var(--primary) / 0.2)',
              fontSize: '0.72rem', fontWeight: 600, flexShrink: 0,
            }}>
              Guide Review
            </span>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Button variant="outline" size="sm" onClick={() => setShowFeedback(!showFeedback)} className="gap-1.5 hidden sm:flex">
              <MessageSquare size={14} /> Feedback
            </Button>
            {approved ? (
              <span style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '6px 12px', borderRadius: 8,
                background: '#f0fdf4', color: '#16a34a',
                border: '1px solid #bbf7d0', fontSize: '0.8rem', fontWeight: 600,
              }}>
                <CheckCircle2 size={14} /> Approved
              </span>
            ) : (
              <Button
                variant="outline" size="sm"
                onClick={() => setConfirmApprove((v) => !v)}
                className="gap-1.5"
                style={{ borderColor: '#16a34a', color: '#16a34a' }}
              >
                <ThumbsUp size={14} /> Approve for Panel
              </Button>
            )}
            <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <><Loader2 size={14} className="animate-spin" />Saving…</>
               : saved ? <><CheckCircle2 size={14} />Saved</>
               : <><Save size={14} />Save</>}
            </Button>
          </div>
        </div>
      </div>

      <div className="px-3 md:px-6 py-4 space-y-5">
        <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5"><Users size={14} />{students.length} student{students.length !== 1 ? 's' : ''}</span>
          {group.guide1_profile && <span>Guide: <strong className="text-foreground">{group.guide1_profile.name}{group.guide2_profile ? `, ${group.guide2_profile.name}` : ''}</strong></span>}
        </div>

        {confirmApprove && !approved && (
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '13px 16px', borderRadius: 'calc(var(--radius) * 1.4)', background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
            <AlertTriangle size={16} style={{ color: '#16a34a', marginTop: 1, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <p style={{ margin: '0 0 10px', fontSize: '0.85rem', color: '#14532d', fontWeight: 500 }}>
                This will mark {group.name} as approved and queue it for panel review. Save your marks first if you haven&apos;t.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <Button
                  size="sm"
                  onClick={handleApprove}
                  disabled={approving}
                  style={{ background: '#16a34a', color: '#fff' }}
                >
                  {approving ? <><Loader2 size={13} className="animate-spin" />Approving…</> : <>Confirm Approval</>}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmApprove(false)} disabled={approving}>Cancel</Button>
              </div>
            </div>
          </div>
        )}

        {error && <div className="text-sm text-destructive bg-destructive/10 rounded-md p-3">{error}</div>}

        {criteria.length === 0 ? (
          <div className="text-sm text-muted-foreground bg-muted rounded-md p-4">
            No guide rubrics set up yet. Ask the admin to create guide-type criteria.
          </div>
        ) : (
          <GradeTable
            students={students}
            gradeColumns={gradeColumns}
            critGroups={critGroups}
            maxTotal={maxTotal}
            getGrade={getGrade}
            studentTotal={studentTotal}
            onGradeChange={setGrade}
            onRubricClick={(title, text) => setRubricPopup({ title, text })}
            onApplyColToAll={applyColToAll}
          />
        )}

        <FeedbackPanel
          group={group}
          students={students}
          feedbacks={feedbacks}
          show={showFeedback}
          onToggle={() => setShowFeedback((v) => !v)}
          onChange={(key, value) => { setFeedbacks((prev) => ({ ...prev, [key]: value })); setSaved(false) }}
        />

        <div className="flex justify-end pb-8">
          <Button size="lg" onClick={handleSave} disabled={saving} className="gap-2 min-w-[140px]">
            {saving ? <><Loader2 className="animate-spin" size={16} />Saving…</>
             : saved ? <><CheckCircle2 size={16} />Saved!</>
             : <><Save size={16} />Save Marks</>}
          </Button>
        </div>
      </div>

      <RubricPopup popup={rubricPopup} onClose={() => setRubricPopup(null)} />
    </div>
  )
}
