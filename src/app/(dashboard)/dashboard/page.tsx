import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { effectiveTagFilter } from '@/lib/admin-scope'
import Link from 'next/link'
import { ClipboardList, Users, CheckCircle2, ChevronRight, Building2, GraduationCap, TrendingUp } from 'lucide-react'

function GroupCard({ group, gradedStudentIds }: {
  group: { id: string; name: string; project_title?: string; students?: { id: string; name: string }[] }
  gradedStudentIds: Set<string>
}) {
  const studentIds = group.students?.map((s) => s.id) ?? []
  const gradedCount = studentIds.filter((id) => gradedStudentIds.has(id)).length
  const total = studentIds.length
  const done = gradedCount === total && total > 0
  const pct = total > 0 ? (gradedCount / total) * 100 : 0

  return (
    <Link href={`/grade/${group.id}`} className="group-card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <span className="group-card-name">{group.name}</span>
        <span className={`group-badge${done ? ' done' : ''}`}>
          {done ? 'Done' : `${gradedCount}/${total}`}
        </span>
      </div>
      {group.project_title && (
        <p className="group-card-title">{group.project_title}</p>
      )}
      <div className="group-card-meta">
        <Users size={13} />
        {total} student{total !== 1 ? 's' : ''}
      </div>
      <div className="group-progress-row">
        <div className="group-progress-bar">
          <div className="group-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <ChevronRight size={15} style={{ color: 'var(--app-hero-subtext)', flexShrink: 0 }} />
      </div>
    </Link>
  )
}

async function InstitutionDashboard({ name, tagCount }: { name: string; tagCount: number }) {
  const admin = createAdminSupabaseClient()
  const [{ data: tags }, { data: profiles }, { data: groups }, { data: grades }] = await Promise.all([
    admin.from('tags').select('*').order('short_name'),
    admin.from('profiles').select('id, role, tag_id'),
    admin.from('groups').select('id, tag_id, students(id)'),
    admin.from('grades').select('student_id').gt('marks', 0),
  ])

  const gradedSet = new Set((grades ?? []).map((g: { student_id: string }) => g.student_id))

  const tagStats = (tags ?? []).map((tag) => {
    const tagProfiles = (profiles ?? []).filter((p: { tag_id: string | null }) => p.tag_id === tag.id)
    const tagGroups = (groups ?? []).filter((g: { tag_id: string | null }) => g.tag_id === tag.id)
    const allStudents = tagGroups.flatMap((g) => (g.students ?? []) as { id: string }[])
    const students = allStudents.length
    const graded = allStudents.filter((s) => gradedSet.has(s.id)).length
    const pct = students > 0 ? Math.round((graded / students) * 100) : 0
    return {
      id: tag.id,
      name: tag.name,
      short_name: tag.short_name,
      faculty: (tagProfiles as { role: string }[]).filter((p) => p.role === 'faculty').length,
      admins: (tagProfiles as { role: string }[]).filter((p) => p.role === 'admin').length,
      groups: tagGroups.length,
      students,
      graded,
      pct,
    }
  })

  const totals = tagStats.reduce(
    (acc, t) => ({ faculty: acc.faculty + t.faculty + t.admins, groups: acc.groups + t.groups, students: acc.students + t.students, graded: acc.graded + t.graded }),
    { faculty: 0, groups: 0, students: 0, graded: 0 }
  )
  const institutionPct = totals.students > 0 ? Math.round((totals.graded / totals.students) * 100) : 0

  return (
    <>
      <div className="dashboard-topbar">
        <p className="eyebrow">Institution Admin</p>
        <h1 className="section-title" style={{ marginTop: 6 }}>Welcome, {name}</h1>
        <p className="section-subtitle">Overview across all {tagCount} Technology Advancement Groups</p>
      </div>

      <div className="dashboard-section">
        <p className="eyebrow">At a glance</p>
        <div className="stat-grid">
          {[
            { icon: <Building2 size={18} />, value: tagCount, label: 'TAGs' },
            { icon: <Users size={18} />, value: totals.faculty, label: 'Faculty' },
            { icon: <ClipboardList size={18} />, value: totals.groups, label: 'Groups' },
            { icon: <GraduationCap size={18} />, value: totals.students, label: 'Students' },
            { icon: <TrendingUp size={18} />, value: `${institutionPct}%`, label: 'Grading Progress' },
          ].map(({ icon, value, label }) => (
            <div key={label} className="stat-card">
              <div className="stat-icon">{icon}</div>
              <span className="stat-value">{value}</span>
              <span className="stat-label">{label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="dashboard-section">
        <p className="eyebrow">TAG breakdown</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16, marginTop: 12 }}>
          {tagStats.map((tag) => (
            <div key={tag.id} style={{
              background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))',
              borderRadius: 'calc(var(--radius) * 1.5)', padding: '20px 24px', boxShadow: 'var(--shadow-md)',
            }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                    fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em',
                    background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))',
                    border: '1px solid hsl(var(--primary) / 0.2)', marginBottom: 8,
                  }}>{tag.short_name}</span>
                  <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--app-hero-text)', lineHeight: 1.35 }}>{tag.name}</p>
                </div>
                <span style={{
                  fontSize: '1.15rem', fontWeight: 800, lineHeight: 1,
                  color: tag.pct >= 75 ? '#16a34a' : tag.pct >= 40 ? '#ca8a04' : 'hsl(var(--muted-foreground))',
                }}>{tag.pct}%</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 14 }}>
                {[
                  { label: 'Faculty', value: tag.faculty + tag.admins },
                  { label: 'Groups', value: tag.groups },
                  { label: 'Students', value: tag.students },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--app-hero-text)', lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: '0.68rem', color: 'hsl(var(--muted-foreground))', marginTop: 3 }}>{label}</div>
                  </div>
                ))}
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', marginBottom: 5 }}>
                  <span>Grading progress</span>
                  <span>{tag.graded}/{tag.students} students</span>
                </div>
                <div style={{ height: 6, background: 'hsl(var(--border))', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', width: `${tag.pct}%`, borderRadius: 99,
                    background: tag.pct >= 75 ? '#16a34a' : tag.pct >= 40 ? '#ca8a04' : '#dc2626',
                  }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tag:tags(*)')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin' || profile?.role === 'institution_admin'
  const tagId = await effectiveTagFilter(profile)

  // Institution admin in institution-wide scope → show TAG overview
  if (profile?.role === 'institution_admin' && !tagId) {
    const { data: tags } = await supabase.from('tags').select('id')
    return <InstitutionDashboard name={profile.name ?? ''} tagCount={tags?.length ?? 0} />
  }

  let groupsQuery = supabase.from('groups').select(`*, students(id, name, roll_number)`)
  if (tagId) groupsQuery = groupsQuery.eq('tag_id', tagId)
  const { data: groupsRaw } = await groupsQuery

  // Natural / numeric sort: "Team 2" before "Team 10"
  const groups = (groupsRaw ?? []).sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
  )

  const { data: myGrades } = await supabase
    .from('grades')
    .select('student_id')
    .eq('faculty_id', user!.id)
    .gt('marks', 0)

  const gradedStudentIds = new Set(myGrades?.map((g) => g.student_id) ?? [])
  const totalStudents = groups.reduce((sum, g) => sum + (g.students?.length ?? 0), 0)

  const pendingGroups = groups.filter((g) => {
    const ids = g.students?.map((s: { id: string }) => s.id) ?? []
    return ids.length === 0 || ids.some((id: string) => !gradedStudentIds.has(id))
  })
  const completedGroups = groups.filter((g) => {
    const ids = g.students?.map((s: { id: string }) => s.id) ?? []
    return ids.length > 0 && ids.every((id: string) => gradedStudentIds.has(id))
  })

  const scopeLabel = profile?.role === 'institution_admin' && !tagId
    ? 'All TAGs — institution view'
    : isAdmin
      ? `${(profile?.tag as { short_name?: string } | null)?.short_name ?? ''} TAG — admin view`
      : 'Groups you\'re reviewing'

  return (
    <>
      {/* Top bar */}
      <div className="dashboard-topbar">
        <p className="eyebrow">Dashboard</p>
        <h1 className="section-title" style={{ marginTop: 6 }}>
          Welcome, {profile?.name}
        </h1>
        <p className="section-subtitle">{scopeLabel}</p>
      </div>

      {/* Stats */}
      <div className="dashboard-section">
        <p className="eyebrow">At a glance</p>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon"><ClipboardList size={18} /></div>
            <span className="stat-value">{groups?.length ?? 0}</span>
            <span className="stat-label">Groups</span>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Users size={18} /></div>
            <span className="stat-value">{totalStudents}</span>
            <span className="stat-label">Students</span>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><CheckCircle2 size={18} /></div>
            <span className="stat-value">{gradedStudentIds.size}</span>
            <span className="stat-label">Graded</span>
          </div>
        </div>
      </div>

      {groups.length === 0 && (
        <div className="dashboard-section">
          <p className="section-subtitle">No groups found.</p>
        </div>
      )}

      {/* Yet to grade */}
      {pendingGroups.length > 0 && (
        <div className="dashboard-section">
          <p className="eyebrow">Still to review</p>
          <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.3rem' }}>
            Left to grade
            <span style={{ marginLeft: 10, fontSize: '0.85rem', fontFamily: 'var(--body-font)', fontWeight: 500, color: 'var(--app-hero-subtext)', letterSpacing: 0 }}>
              {pendingGroups.length} group{pendingGroups.length !== 1 ? 's' : ''}
            </span>
          </h2>
          <div className="group-grid">
            {pendingGroups.map((group) => <GroupCard key={group.id} group={group} gradedStudentIds={gradedStudentIds} />)}
          </div>
        </div>
      )}

      {/* Completed */}
      {completedGroups.length > 0 && (
        <div className="dashboard-section">
          <p className="eyebrow" style={{ color: '#166534' }}>Completed</p>
          <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.3rem' }}>
            Graded
            <span style={{ marginLeft: 10, fontSize: '0.85rem', fontFamily: 'var(--body-font)', fontWeight: 500, color: 'var(--app-hero-subtext)', letterSpacing: 0 }}>
              {completedGroups.length} group{completedGroups.length !== 1 ? 's' : ''}
            </span>
          </h2>
          <div className="group-grid">
            {completedGroups.map((group) => <GroupCard key={group.id} group={group} gradedStudentIds={gradedStudentIds} />)}
          </div>
        </div>
      )}
    </>
  )
}
