import { Card, CardContent } from '@/components/ui/card'
import { Info } from 'lucide-react'
import { GradeInput } from './GradeInput'
import type { Student } from '@/types/database'

export type GradeCol = {
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

export type CritGroup = {
  critId: string
  critTitle: string
  critDesc: string
  count: number
  hasSub: boolean
  max: number
}

const ROLL_PREFIX = 'CB.SC.U4CSE'
function shortRoll(r: string) { return r.startsWith(ROLL_PREFIX) ? r.slice(ROLL_PREFIX.length) : r }
function toTitleCase(name: string) {
  return name.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ')
}

const ROLL_W = 58

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
  ...thBase, position: 'sticky', left: 0, zIndex: 3,
  minWidth: ROLL_W, textAlign: 'left', borderRight: '2px solid hsl(var(--border))',
}
const stickyNameTh: React.CSSProperties = {
  ...thBase, position: 'sticky', left: ROLL_W, zIndex: 3,
  minWidth: 140, textAlign: 'left', borderRight: '2px solid hsl(var(--border))',
}
const tdBase: React.CSSProperties = {
  padding: '8px 10px',
  textAlign: 'center',
  verticalAlign: 'middle',
  borderBottom: '1px solid hsl(var(--border) / 0.4)',
  borderRight: '1px solid hsl(var(--border) / 0.25)',
}
const stickyRollTd = (bg: string): React.CSSProperties => ({
  ...tdBase, position: 'sticky', left: 0, zIndex: 2,
  textAlign: 'left', fontSize: '0.75rem', fontWeight: 500, letterSpacing: '0.01em',
  color: 'hsl(var(--foreground))', background: bg, borderRight: '2px solid hsl(var(--border))',
})
const stickyNameTd = (bg: string): React.CSSProperties => ({
  ...tdBase, position: 'sticky', left: ROLL_W, zIndex: 2,
  textAlign: 'left', fontWeight: 500, fontSize: '0.85rem',
  minWidth: 140, background: bg, borderRight: '2px solid hsl(var(--border))',
})

export function GradeTable({
  students,
  gradeColumns,
  critGroups,
  maxTotal,
  getGrade,
  studentTotal,
  onGradeChange,
  onRubricClick,
  onApplyColToAll,
}: {
  students: Student[]
  gradeColumns: GradeCol[]
  critGroups: CritGroup[]
  maxTotal: number
  getGrade: (studentId: string, criteriaId: string, subId: string | null) => number
  studentTotal: (studentId: string) => number
  onGradeChange: (studentId: string, criteriaId: string, subId: string | null, value: number) => void
  onRubricClick: (title: string, text: string) => void
  onApplyColToAll: (col: GradeCol) => void
}) {
  const hasAnySub = critGroups.some((g) => g.hasSub)

  if (gradeColumns.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-muted-foreground">
          <Info size={32} className="mx-auto mb-3 opacity-40" />
          <p>No rubric set up for this project type yet.</p>
          <p className="text-sm">Ask an admin to add criteria for this type.</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="overflow-hidden">
      <div style={{ overflowX: 'auto', overflowY: 'visible', WebkitOverflowScrolling: 'touch' } as React.CSSProperties}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 360 }}>
          <thead>
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
                    minWidth: 110,
                  }}
                >
                  <div style={{ lineHeight: 1.4 }}>
                    {g.critTitle.split('/').map((part, i, arr) => (
                      <span key={i}>
                        {i > 0 && <br />}
                        <span style={{ color: 'var(--app-hero-text)' }}>{part.trim()}</span>
                        {i === arr.length - 1 && g.critDesc && (
                          <button
                            onClick={() => onRubricClick(g.critTitle, g.critDesc)}
                            title="View rubric"
                            style={{ display: 'inline-flex', verticalAlign: 'middle', marginLeft: 3, background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--primary))', padding: 0, lineHeight: 1, touchAction: 'manipulation' }}
                          >
                            <Info size={12} />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  <div style={{ color: 'hsl(var(--muted-foreground))', fontSize: '0.65rem', marginTop: 3 }}>({g.max} Marks)</div>
                </th>
              ))}
              <th style={{ ...thBase, borderBottom: '2px solid hsl(var(--border))', minWidth: 64 }} rowSpan={hasAnySub ? 2 : 1}>
                Total
              </th>
            </tr>

            {hasAnySub && (
              <tr>
                {gradeColumns.map((col) => {
                  if (col.subId === null) return null
                  return (
                    <th key={col.key} style={{ ...thBase, fontSize: '0.68rem', fontWeight: 500, minWidth: 110 }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                        <span>{col.subTitle}</span>
                        {col.subDesc && (
                          <button
                            onClick={() => onRubricClick(col.subTitle!, col.subDesc!)}
                            title="View rubric"
                            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'hsl(var(--primary))', padding: 0, lineHeight: 1, touchAction: 'manipulation' }}
                          >
                            <Info size={11} />
                          </button>
                        )}
                      </div>
                      <div style={{ color: 'hsl(var(--muted-foreground))', marginTop: 2 }}>{col.max} mk</div>
                      <button
                        onClick={() => onApplyColToAll(col)}
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
              const displayName = tc.length > 18 ? tc.slice(0, 18) + '…' : tc
              return (
                <tr key={student.id} style={{ background: rowBg }}>
                  <td style={stickyRollTd(rowBg)} title={student.roll_number}>{shortRoll(student.roll_number)}</td>
                  <td style={stickyNameTd(rowBg)} title={tc.length > 12 ? tc : undefined}>{displayName}</td>
                  {gradeColumns.map((col) => (
                    <td key={col.key} style={tdBase}>
                      <GradeInput
                        value={getGrade(student.id, col.critId, col.subId)}
                        max={col.max}
                        allowedMarks={col.allowedMarks}
                        onChange={(v) => onGradeChange(student.id, col.critId, col.subId, v)}
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
                  ...tdBase, position: 'sticky', left: 0, zIndex: 2,
                  background: 'hsl(var(--muted))', fontWeight: 600, fontSize: '0.75rem',
                  color: 'var(--app-hero-subtext)', textAlign: 'left',
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
  )
}
