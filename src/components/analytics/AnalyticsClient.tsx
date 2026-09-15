'use client'

import type { Group, Student, Criteria, Grade, Profile } from '@/types/database'
import { BarChart2, TrendingUp, Users, ShieldCheck, Target, Award, Activity } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'

interface Props {
  isAdmin: boolean
  facultyId: string
  facultyName: string
  groups: Group[]
  students: Student[]
  criteria: Criteria[]
  myGrades: Grade[]
  allGrades: Grade[]
  profiles: Profile[]
}

// ── Colour helpers ────────────────────────────────────────────────────────────

function pctColor(pct: number): string {
  if (pct >= 75) return '#16a34a'
  if (pct >= 50) return '#ca8a04'
  return '#dc2626'
}
function pctBg(pct: number): string {
  if (pct >= 75) return '#dcfce7'
  if (pct >= 50) return '#fef9c3'
  return '#fee2e2'
}
function typeColor(pt: string) {
  if (pt === 'research')    return { bg: '#ede9fe', tx: '#5b21b6' }
  if (pt === 'application') return { bg: '#dcfce7', tx: '#15803d' }
  return                           { bg: '#dbeafe', tx: '#1d4ed8' }
}
function capitalize(s: string) { return s ? s[0].toUpperCase() + s.slice(1) : '' }

// ── Computation helpers ───────────────────────────────────────────────────────

function critMaxForGroup(group: Group, allCriteria: Criteria[]): number {
  const pt = group.project_type
  if (!pt) return 0
  return allCriteria
    .filter(c => c.project_type === pt || c.project_type === 'all')
    .reduce((s, c) => s + c.max_marks, 0)
}

function studentScoreByFaculty(
  studentId: string,
  group: Group,
  allCriteria: Criteria[],
  grades: Grade[],
  facultyId: string,
): number {
  const pt = group.project_type
  if (!pt) return 0
  const relevantCriteria = allCriteria.filter(c => c.project_type === pt || c.project_type === 'all')
  let total = 0
  for (const crit of relevantCriteria) {
    if (crit.sub_criteria && crit.sub_criteria.length > 0) {
      for (const sub of crit.sub_criteria) {
        const g = grades.find(r => r.faculty_id === facultyId && r.student_id === studentId && r.criteria_id === crit.id && r.sub_criteria_id === sub.id)
        total += g?.marks ?? 0
      }
    } else {
      const g = grades.find(r => r.faculty_id === facultyId && r.student_id === studentId && r.criteria_id === crit.id && r.sub_criteria_id === null)
      total += g?.marks ?? 0
    }
  }
  return total
}

function studentMeanScore(
  studentId: string,
  group: Group,
  allCriteria: Criteria[],
  grades: Grade[],
): number {
  const pt = group.project_type
  if (!pt) return 0
  const relevantCriteria = allCriteria.filter(c => c.project_type === pt || c.project_type === 'all')
  const facultyIds = [...new Set(grades.filter(g => g.student_id === studentId).map(g => g.faculty_id))]
  if (facultyIds.length === 0) return 0
  const totals = facultyIds.map(fid => {
    let total = 0
    for (const crit of relevantCriteria) {
      if (crit.sub_criteria && crit.sub_criteria.length > 0) {
        for (const sub of crit.sub_criteria) {
          const g = grades.find(r => r.faculty_id === fid && r.student_id === studentId && r.criteria_id === crit.id && r.sub_criteria_id === sub.id)
          total += g?.marks ?? 0
        }
      } else {
        const g = grades.find(r => r.faculty_id === fid && r.student_id === studentId && r.criteria_id === crit.id && r.sub_criteria_id === null)
        total += g?.marks ?? 0
      }
    }
    return total
  })
  return totals.reduce((a, b) => a + b, 0) / totals.length
}

function bucketize(pcts: number[]): number[] {
  const bins = Array(10).fill(0)
  for (const p of pcts) {
    const idx = Math.min(Math.floor(p / 10), 9)
    bins[idx]++
  }
  return bins
}

// ── Primitive chart components ────────────────────────────────────────────────

function HBar({ pct, color, bg }: { pct: number; color: string; bg?: string }) {
  return (
    <div style={{ flex: 1, height: 10, borderRadius: 6, background: bg ?? '#e5e7eb', overflow: 'hidden' }}>
      <div style={{ width: `${Math.max(pct, 0)}%`, height: '100%', background: color, borderRadius: 6, transition: 'width 0.4s ease' }} />
    </div>
  )
}

const BUCKET_LABELS = ['0–10', '10–20', '20–30', '30–40', '40–50', '50–60', '60–70', '70–80', '80–90', '90–100']

function Histogram({ bins }: { bins: number[] }) {
  const data = bins.map((count, i) => ({
    label: `${i * 10}`,
    fullLabel: BUCKET_LABELS[i],
    count,
    color: (i + 1) * 10 > 75 ? '#16a34a' : (i + 1) * 10 > 50 ? '#ca8a04' : '#dc2626',
  }))

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} barSize={22} margin={{ top: 4, right: 4, left: -28, bottom: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <YAxis allowDecimals={false} tick={{ fontSize: 10, fill: '#9ca3af' }} axisLine={false} tickLine={false} />
        <Tooltip
          cursor={{ fill: 'hsl(var(--muted) / 0.4)' }}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null
            const d = payload[0].payload as (typeof data)[0]
            return (
              <div style={{
                background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
                borderRadius: 8, padding: '6px 10px', fontSize: '0.78rem',
              }}>
                <p style={{ margin: 0, fontWeight: 600 }}>{d.fullLabel}%</p>
                <p style={{ margin: 0, color: 'hsl(var(--muted-foreground))' }}>
                  {d.count} student{d.count !== 1 ? 's' : ''}
                </p>
              </div>
            )
          }}
        />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((entry, i) => (
            <Cell key={i} fill={entry.count > 0 ? entry.color : '#e5e7eb'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children, adminOnly }: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  adminOnly?: boolean
}) {
  return (
    <div style={{
      border: `1px solid ${adminOnly ? 'hsl(270 60% 88%)' : 'hsl(var(--border))'}`,
      borderRadius: 'calc(var(--radius) * 1.6)',
      overflow: 'hidden',
      background: 'hsl(var(--card))',
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 16px',
        borderBottom: `1px solid ${adminOnly ? 'hsl(270 60% 92%)' : 'hsl(var(--border))'}`,
        background: adminOnly ? 'hsl(270 60% 97%)' : 'hsl(var(--muted) / 0.4)',
      }}>
        <Icon size={14} style={{ color: adminOnly ? '#7c3aed' : 'var(--brand-600)', flexShrink: 0 }} />
        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: adminOnly ? '#5b21b6' : 'hsl(var(--foreground))' }}>
          {title}
        </span>
        {adminOnly && (
          <span style={{ marginLeft: 'auto', fontSize: '0.68rem', fontWeight: 600, color: '#7c3aed', background: '#ede9fe', padding: '1px 7px', borderRadius: 99 }}>
            Admin
          </span>
        )}
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  )
}

function StatPill({ value, label, color }: { value: string | number; label: string; color: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '12px 16px', background: 'hsl(var(--muted) / 0.4)', borderRadius: 'calc(var(--radius) * 1.2)', flex: 1 }}>
      <div style={{ fontSize: '1.6rem', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      <div style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', marginTop: 4 }}>{label}</div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function AnalyticsClient({
  isAdmin, facultyId, facultyName,
  groups, students, criteria,
  myGrades, allGrades, profiles,
}: Props) {

  // ── Personal stats ─────────────────────────────────────────────────────────

  const myGradedStudentIds = new Set(myGrades.map(g => g.student_id))
  const totalStudents = students.length
  const myGradedCount = myGradedStudentIds.size

  const groupsIEvaluated = groups.filter(g => {
    const groupStudentIds = students.filter(s => s.group_id === g.id).map(s => s.id)
    return groupStudentIds.length > 0 && groupStudentIds.every(id => myGradedStudentIds.has(id))
  })
  const groupsPartial = groups.filter(g => {
    const groupStudentIds = students.filter(s => s.group_id === g.id).map(s => s.id)
    return groupStudentIds.some(id => myGradedStudentIds.has(id)) && !groupStudentIds.every(id => myGradedStudentIds.has(id))
  })

  // My score distribution (% of max for each student I graded)
  const myStudentPcts: number[] = []
  for (const studentId of myGradedStudentIds) {
    const student = students.find(s => s.id === studentId)
    if (!student) continue
    const group = groups.find(g => g.id === student.group_id)
    if (!group || !group.project_type) continue
    const max = critMaxForGroup(group, criteria)
    if (max === 0) continue
    const score = studentScoreByFaculty(studentId, group, criteria, myGrades, facultyId)
    myStudentPcts.push((score / max) * 100)
  }
  const myHistogram = bucketize(myStudentPcts)
  const myAvgPct = myStudentPcts.length > 0
    ? myStudentPcts.reduce((a, b) => a + b, 0) / myStudentPcts.length
    : 0

  // My criteria pattern
  const myCriteriaAvg: { title: string; avgPct: number; count: number }[] = criteria.map(crit => {
    const relevantGrades = myGrades.filter(g => g.criteria_id === crit.id)
    if (relevantGrades.length === 0) return { title: crit.title, avgPct: 0, count: 0 }
    const subCriteria = crit.sub_criteria ?? []
    if (subCriteria.length > 0) {
      const subAvgs = subCriteria.map(sub => {
        const subGrades = myGrades.filter(g => g.criteria_id === crit.id && g.sub_criteria_id === sub.id)
        const avg = subGrades.length > 0 ? subGrades.reduce((a, g) => a + g.marks, 0) / subGrades.length : 0
        return (avg / sub.max_marks) * 100
      })
      return { title: crit.title, avgPct: subAvgs.reduce((a, b) => a + b, 0) / subAvgs.length, count: relevantGrades.length }
    }
    const avg = relevantGrades.reduce((a, g) => a + g.marks, 0) / relevantGrades.length
    return { title: crit.title, avgPct: (avg / crit.max_marks) * 100, count: relevantGrades.length }
  }).filter(c => c.count > 0)

  // ── Admin computations ─────────────────────────────────────────────────────

  // Class score distribution
  const allGradedStudentIds = new Set(allGrades.map(g => g.student_id))
  const classStudentPcts: number[] = []
  for (const studentId of allGradedStudentIds) {
    const student = students.find(s => s.id === studentId)
    if (!student) continue
    const group = groups.find(g => g.id === student.group_id)
    if (!group || !group.project_type) continue
    const max = critMaxForGroup(group, criteria)
    if (max === 0) continue
    const mean = studentMeanScore(studentId, group, criteria, allGrades)
    classStudentPcts.push((mean / max) * 100)
  }
  const classHistogram = bucketize(classStudentPcts)
  const classAvgPct = classStudentPcts.length > 0
    ? classStudentPcts.reduce((a, b) => a + b, 0) / classStudentPcts.length
    : 0

  // Criteria heatmap (class-wide)
  const classCriteriaAvg: { title: string; avgPct: number; type: string }[] = criteria.map(crit => {
    const subCriteria = crit.sub_criteria ?? []
    if (subCriteria.length > 0) {
      const subAvgs = subCriteria.map(sub => {
        const subGrades = allGrades.filter(g => g.criteria_id === crit.id && g.sub_criteria_id === sub.id)
        const avg = subGrades.length > 0 ? subGrades.reduce((a, g) => a + g.marks, 0) / subGrades.length : 0
        return (avg / sub.max_marks) * 100
      })
      return { title: crit.title, avgPct: subAvgs.reduce((a, b) => a + b, 0) / subAvgs.length, type: crit.project_type }
    }
    const relevantGrades = allGrades.filter(g => g.criteria_id === crit.id)
    const avg = relevantGrades.length > 0 ? relevantGrades.reduce((a, g) => a + g.marks, 0) / relevantGrades.length : 0
    return { title: crit.title, avgPct: (avg / crit.max_marks) * 100, type: crit.project_type }
  })

  // Group leaderboard
  interface LeaderboardRow { group: Group; pct: number; mean: number; max: number; gradedStudents: number; totalStudents: number; raterCount: number; spread: number }
  const groupLeaderboard: LeaderboardRow[] = groups
    .filter(g => g.project_type)
    .map(group => {
      const groupStudents = students.filter(s => s.group_id === group.id)
      const gradedStudents = groupStudents.filter(s => allGradedStudentIds.has(s.id))
      if (gradedStudents.length === 0) return null
      const max = critMaxForGroup(group, criteria)
      const studentMeans = gradedStudents.map(s => studentMeanScore(s.id, group, criteria, allGrades))
      const groupMean = studentMeans.reduce((a, b) => a + b, 0) / studentMeans.length
      const pct = max > 0 ? (groupMean / max) * 100 : 0
      // Inter-rater spread
      const facultyIds = [...new Set(allGrades.filter(g => groupStudents.some(s => s.id === g.student_id)).map(g => g.faculty_id))]
      const facultyTotals = facultyIds.map(fid => {
        const scores = gradedStudents.map(s => studentScoreByFaculty(s.id, group, criteria, allGrades, fid))
        return scores.reduce((a, b) => a + b, 0) / scores.length
      }).filter(t => t > 0)
      const spread = facultyTotals.length > 1
        ? Math.max(...facultyTotals) - Math.min(...facultyTotals)
        : 0
      return { group, pct, mean: groupMean, max, gradedStudents: gradedStudents.length, totalStudents: groupStudents.length, raterCount: facultyTotals.length, spread }
    })
    .filter((r): r is LeaderboardRow => r !== null)
    .sort((a, b) => b.pct - a.pct)

  // Faculty coverage
  const facultyCoverage = profiles.map(p => {
    const gradedStudentIds = new Set(allGrades.filter(g => g.faculty_id === p.id).map(g => g.student_id))
    const gradedGroups = groups.filter(g => {
      const gStudents = students.filter(s => s.group_id === g.id).map(s => s.id)
      return gStudents.some(id => gradedStudentIds.has(id))
    })
    return { profile: p, studentsGraded: gradedStudentIds.size, groupsGraded: gradedGroups.length }
  }).sort((a, b) => b.studentsGraded - a.studentsGraded)

  const adminTotalGraded = new Set(allGrades.map(g => g.student_id)).size

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '20px 20px 40px', maxWidth: 820 }}>

      {/* Page header */}
      <div style={{ marginBottom: 24 }}>
        <p className="eyebrow" style={{ marginBottom: 4 }}>Analytics</p>
        <h1 style={{ margin: 0, fontFamily: 'var(--title-font)', fontSize: '1.9rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)', lineHeight: 1.1 }}>
          Performance Insights
        </h1>
        <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.88rem', marginTop: 6 }}>
          {isAdmin ? 'Class-wide analytics and your personal grading summary.' : 'Your grading summary and scoring patterns.'}
        </p>
      </div>

      <div style={{ display: 'grid', gap: 16 }}>

        {/* ── Personal: summary pills ── */}
        <SectionCard title={`My Grading Summary — ${facultyName}`} icon={Activity}>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: myGradedCount > 0 ? 16 : 0 }}>
            <StatPill value={groupsIEvaluated.length} label="Teams fully graded" color="var(--brand-600)" />
            <StatPill value={groupsPartial.length} label="Teams in progress" color="#ca8a04" />
            <StatPill value={myGradedCount} label={`of ${totalStudents} students`} color="#4f46e5" />
            <StatPill
              value={myStudentPcts.length > 0 ? `${myAvgPct.toFixed(1)}%` : '—'}
              label="Avg score given"
              color={myAvgPct > 0 ? pctColor(myAvgPct) : 'hsl(var(--muted-foreground))'}
            />
          </div>
          {myGradedCount === 0 && (
            <p style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.84rem', textAlign: 'center', padding: '8px 0' }}>
              You haven&apos;t graded any students yet.
            </p>
          )}
        </SectionCard>

        {/* ── Personal: score distribution ── */}
        {myStudentPcts.length > 0 && (
          <SectionCard title="My Score Distribution" icon={BarChart2}>
            <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
              % of max marks given across {myStudentPcts.length} student{myStudentPcts.length !== 1 ? 's' : ''} you evaluated
            </p>
            <Histogram bins={myHistogram} />
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', marginTop: 6 }}>Score bucket (%)</p>
          </SectionCard>
        )}

        {/* ── Personal: criteria pattern ── */}
        {myCriteriaAvg.length > 0 && (
          <SectionCard title="My Criteria Scoring Pattern" icon={Target}>
            <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: 14 }}>
              Your average score per criterion as % of maximum marks
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {myCriteriaAvg.map(({ title, avgPct }) => (
                <div key={title}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.78rem', color: 'hsl(var(--foreground))', maxWidth: '70%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {title}
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: 700, color: pctColor(avgPct) }}>
                      {avgPct.toFixed(1)}%
                    </span>
                  </div>
                  <HBar pct={avgPct} color={pctColor(avgPct)} />
                </div>
              ))}
            </div>
          </SectionCard>
        )}

        {/* ── Admin: class overview ── */}
        {isAdmin && (
          <SectionCard title="Class Overview" icon={Users} adminOnly>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <StatPill value={adminTotalGraded} label={`of ${totalStudents} students graded`} color="#4f46e5" />
              <StatPill value={groupLeaderboard.length} label={`of ${groups.filter(g => g.project_type).length} teams evaluated`} color="var(--brand-600)" />
              <StatPill
                value={classStudentPcts.length > 0 ? `${classAvgPct.toFixed(1)}%` : '—'}
                label="Class avg score"
                color={classAvgPct > 0 ? pctColor(classAvgPct) : 'hsl(var(--muted-foreground))'}
              />
              <StatPill value={facultyCoverage.filter(f => f.studentsGraded > 0).length} label={`of ${profiles.length} faculty graded`} color="#7c3aed" />
            </div>
          </SectionCard>
        )}

        {/* ── Admin: class score distribution ── */}
        {isAdmin && classStudentPcts.length > 0 && (
          <SectionCard title="Class Score Distribution" icon={BarChart2} adminOnly>
            <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
              Mean score across all faculty per student — {classStudentPcts.length} students graded
            </p>
            <Histogram bins={classHistogram} />
            <p style={{ fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))', textAlign: 'center', marginTop: 6 }}>Score bucket (%)</p>
          </SectionCard>
        )}

        {/* ── Admin: criteria heatmap ── */}
        {isAdmin && classCriteriaAvg.length > 0 && (
          <SectionCard title="Criteria Performance Heatmap" icon={TrendingUp} adminOnly>
            <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: 14 }}>
              Class average per criterion as % of max marks — reveals rubric strengths and gaps
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              {classCriteriaAvg.map(({ title, avgPct, type }) => {
                const tc = type !== 'all' ? typeColor(type) : null
                return (
                  <div key={title}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, gap: 8 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        {tc && (
                          <span style={{ flexShrink: 0, fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', borderRadius: 99, background: tc.bg, color: tc.tx }}>
                            {capitalize(type)}
                          </span>
                        )}
                        <span style={{ fontSize: '0.78rem', color: 'hsl(var(--foreground))', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {title}
                        </span>
                      </div>
                      <span style={{ flexShrink: 0, fontSize: '0.78rem', fontWeight: 700, color: pctColor(avgPct) }}>
                        {avgPct.toFixed(1)}%
                      </span>
                    </div>
                    <HBar pct={avgPct} color={pctColor(avgPct)} />
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

        {/* ── Admin: group leaderboard ── */}
        {isAdmin && groupLeaderboard.length > 0 && (
          <SectionCard title="Group Leaderboard" icon={Award} adminOnly>
            <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
              Ranked by mean total score across all panel members
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid hsl(var(--border))' }}>
                    {['#', 'Group', 'Type', 'Score', 'Raters', 'Spread', ''].map(h => (
                      <th key={h} style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 600, color: 'hsl(var(--muted-foreground))', whiteSpace: 'nowrap', fontSize: '0.73rem' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groupLeaderboard.map((row: LeaderboardRow, i: number) => {
                    const tc = typeColor(row.group.project_type)
                    return (
                      <tr key={row.group.id} style={{ borderBottom: '1px solid hsl(var(--border) / 0.5)', background: i % 2 === 0 ? 'transparent' : 'hsl(var(--muted) / 0.2)' }}>
                        <td style={{ padding: '8px', color: 'hsl(var(--muted-foreground))', fontWeight: 600 }}>{i + 1}</td>
                        <td style={{ padding: '8px' }}>
                          <div style={{ fontWeight: 600 }}>{row.group.name}</div>
                          {row.group.project_title && <div style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.group.project_title}</div>}
                        </td>
                        <td style={{ padding: '8px' }}>
                          <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99, background: tc.bg, color: tc.tx }}>{capitalize(row.group.project_type)}</span>
                        </td>
                        <td style={{ padding: '8px', fontWeight: 700, color: pctColor(row.pct) }}>{row.pct.toFixed(1)}%</td>
                        <td style={{ padding: '8px', color: 'hsl(var(--muted-foreground))' }}>{row.raterCount}</td>
                        <td style={{ padding: '8px', color: row.spread > 20 ? '#dc2626' : row.spread > 10 ? '#ca8a04' : '#16a34a', fontWeight: 600 }}>
                          {row.spread > 0 ? `±${(row.spread / 2).toFixed(1)}` : '—'}
                        </td>
                        <td style={{ padding: '8px', minWidth: 80 }}>
                          <HBar pct={row.pct} color={pctColor(row.pct)} bg="hsl(var(--muted))" />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', marginTop: 10 }}>
              Spread = half the gap between highest and lowest faculty total for that group
            </p>
          </SectionCard>
        )}

        {/* ── Admin: faculty coverage ── */}
        {isAdmin && facultyCoverage.length > 0 && (
          <SectionCard title="Faculty Grading Coverage" icon={ShieldCheck} adminOnly>
            <p style={{ fontSize: '0.78rem', color: 'hsl(var(--muted-foreground))', marginBottom: 12 }}>
              How many students and teams each faculty member has evaluated
            </p>
            <div style={{ display: 'grid', gap: 8 }}>
              {facultyCoverage.map(({ profile: p, studentsGraded, groupsGraded }) => {
                const pct = totalStudents > 0 ? (studentsGraded / totalStudents) * 100 : 0
                return (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: 'hsl(var(--muted))', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.75rem', fontWeight: 700, color: 'var(--brand-600)',
                    }}>
                      {p.name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                        <span style={{ fontSize: '0.75rem', color: pctColor(pct), fontWeight: 600, flexShrink: 0, marginLeft: 8 }}>
                          {studentsGraded} students · {groupsGraded} teams
                        </span>
                      </div>
                      <HBar pct={pct} color={studentsGraded > 0 ? 'hsl(var(--brand-600))' : '#e5e7eb'} />
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        )}

      </div>
    </div>
  )
}
