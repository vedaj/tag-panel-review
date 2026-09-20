'use client'

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  CartesianGrid, Legend,
} from 'recharts'

export interface TagAnalyticsData {
  id: string
  short_name: string
  name: string
  pct: number
  students: number
  graded: number
  groups: number
  faculty: number
  faculty_grading: number
  faculty_pct: number
}

interface Props {
  tags: TagAnalyticsData[]
}

function pctColor(pct: number) {
  if (pct >= 75) return '#16a34a'
  if (pct >= 40) return '#ca8a04'
  return '#dc2626'
}

interface TooltipPayload { name: string; value: number; color: string }
interface TooltipProps { active?: boolean; payload?: TooltipPayload[]; label?: string }

function CustomTooltip({ active, payload, label }: TooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
      borderRadius: 10, padding: '10px 14px', fontSize: '0.82rem',
      boxShadow: 'var(--shadow-md)',
    }}>
      <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--app-hero-text)' }}>{label}</p>
      {payload.map((p) => (
        <p key={p.name} style={{ margin: '2px 0', color: p.color ?? 'var(--app-hero-text)' }}>
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  )
}

export default function InstitutionAnalyticsClient({ tags }: Props) {
  const totalStudents = tags.reduce((s, t) => s + t.students, 0)
  const totalGraded = tags.reduce((s, t) => s + t.graded, 0)
  const institutionPct = totalStudents > 0 ? Math.round((totalGraded / totalStudents) * 100) : 0

  return (
    <div style={{ padding: '0 0 48px' }}>
      <div className="dashboard-topbar">
        <p className="eyebrow">Institution Admin</p>
        <h1 className="section-title" style={{ marginTop: 6 }}>Cross-TAG Analytics</h1>
        <p className="section-subtitle">
          Performance and grading progress across all {tags.length} Technology Advancement Groups
          &nbsp;·&nbsp; Institution-wide completion: <strong>{institutionPct}%</strong>
          &nbsp;({totalGraded}/{totalStudents} students)
        </p>
      </div>

      {/* Grading Progress */}
      <div className="dashboard-section">
        <p className="eyebrow">Grading completion</p>
        <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.15rem' }}>
          Students graded per TAG
        </h2>
        <p className="section-subtitle" style={{ marginBottom: 20 }}>
          Percentage of students in each TAG who have received at least one grade.
        </p>
        <div style={{ display: 'grid', gap: 10 }}>
          {[...tags].sort((a, b) => b.pct - a.pct).map((tag) => (
            <div key={tag.id} style={{
              background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
              borderRadius: 10, padding: '14px 18px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                <span style={{
                  minWidth: 52, padding: '2px 8px', borderRadius: 999, textAlign: 'center',
                  fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em',
                  background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))',
                  border: '1px solid hsl(var(--primary) / 0.2)',
                }}>{tag.short_name}</span>
                <span style={{ fontSize: '0.82rem', color: 'var(--app-hero-text)', fontWeight: 500, flex: 1 }}>{tag.name}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: pctColor(tag.pct) }}>
                  {tag.pct}%
                </span>
                <span style={{ fontSize: '0.72rem', color: 'hsl(var(--muted-foreground))', minWidth: 80, textAlign: 'right' }}>
                  {tag.graded}/{tag.students} students
                </span>
              </div>
              <div style={{ height: 6, background: 'hsl(var(--border))', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%', width: `${tag.pct}%`,
                  background: pctColor(tag.pct), borderRadius: 99,
                  transition: 'width 0.4s ease',
                }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Faculty Participation */}
      <div className="dashboard-section">
        <p className="eyebrow">Faculty participation</p>
        <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.15rem' }}>
          Grading activity by TAG
        </h2>
        <p className="section-subtitle" style={{ marginBottom: 20 }}>
          Faculty who have submitted at least one grade, out of total faculty per TAG.
        </p>
        <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, padding: '24px 8px 8px' }}>
          <ResponsiveContainer width="100%" height={Math.max(180, tags.length * 44)}>
            <BarChart
              layout="vertical"
              data={tags.map((t) => ({ name: t.short_name, fullName: t.name, Active: t.faculty_grading, Inactive: t.faculty - t.faculty_grading }))}
              margin={{ left: 8, right: 32, top: 0, bottom: 0 }}
            >
              <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis dataKey="name" type="category" width={52} tick={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--primary))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.78rem', paddingTop: 16 }} />
              <Bar dataKey="Active" stackId="a" fill="#16a34a" name="Grading" radius={[0, 0, 0, 0]} />
              <Bar dataKey="Inactive" stackId="a" fill="hsl(var(--border))" name="Not yet grading" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Groups & Students */}
      <div className="dashboard-section">
        <p className="eyebrow">Scale by TAG</p>
        <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.15rem' }}>
          Groups and students per TAG
        </h2>
        <p className="section-subtitle" style={{ marginBottom: 20 }}>
          Distribution of project groups and enrolled students across TAGs.
        </p>
        <div style={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, padding: '24px 8px 8px' }}>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={tags.map((t) => ({ name: t.short_name, Groups: t.groups, Students: t.students }))}
              margin={{ left: 8, right: 32, top: 0, bottom: 0 }}
              barGap={4}
            >
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: 'hsl(var(--primary))' }} />
              <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
              <Tooltip content={<CustomTooltip />} />
              <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: '0.78rem', paddingTop: 16 }} />
              <Bar dataKey="Groups" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Students" fill="#60a5fa" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Summary table */}
      <div className="dashboard-section">
        <p className="eyebrow">Summary</p>
        <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.15rem', marginBottom: 12 }}>
          All TAGs at a glance
        </h2>
        <div style={{
          background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
          borderRadius: 12, overflow: 'hidden',
        }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid hsl(var(--border))', background: 'hsl(var(--muted) / 0.4)' }}>
                {['TAG', 'Faculty', 'Groups', 'Students', 'Graded', 'Progress', 'Faculty Grading'].map((h) => (
                  <th key={h} style={{
                    padding: '10px 16px', textAlign: h === 'TAG' ? 'left' : 'center',
                    fontSize: '0.72rem', fontWeight: 700, letterSpacing: '0.04em',
                    color: 'hsl(var(--muted-foreground))', textTransform: 'uppercase',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tags.map((tag, i) => (
                <tr key={tag.id} style={{ borderBottom: i < tags.length - 1 ? '1px solid hsl(var(--border))' : 'none' }}>
                  <td style={{ padding: '12px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '2px 8px', borderRadius: 999,
                        fontSize: '0.68rem', fontWeight: 800, letterSpacing: '0.04em',
                        background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))',
                        border: '1px solid hsl(var(--primary) / 0.2)',
                      }}>{tag.short_name}</span>
                      <span style={{ color: 'var(--app-hero-text)', fontWeight: 500 }}>{tag.name}</span>
                    </div>
                  </td>
                  {[tag.faculty, tag.groups, tag.students, tag.graded].map((v, j) => (
                    <td key={j} style={{ padding: '12px 16px', textAlign: 'center', color: 'var(--app-hero-text)', fontWeight: 600 }}>{v}</td>
                  ))}
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    <span style={{
                      fontWeight: 700, fontSize: '0.88rem',
                      color: pctColor(tag.pct),
                    }}>{tag.pct}%</span>
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center', color: 'hsl(var(--muted-foreground))' }}>
                    {tag.faculty_grading}/{tag.faculty}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
