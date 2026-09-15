import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { ClipboardList, Users, CheckCircle2, ChevronRight } from 'lucide-react'

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

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const { data: groupsRaw } = await supabase
    .from('groups')
    .select(`*, students(id, name, roll_number)`)

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

  return (
    <>
      {/* Top bar */}
      <div className="dashboard-topbar">
        <p className="eyebrow">Dashboard</p>
        <h1 className="section-title" style={{ marginTop: 6 }}>
          Welcome, {profile?.name}
        </h1>
        <p className="section-subtitle">
          {isAdmin ? 'Admin view — all groups' : 'Your assigned panel groups'}
        </p>
      </div>

      {/* Stats */}
      <div className="dashboard-section">
        <p className="eyebrow">Overview</p>
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
            <span className="stat-label">Students Graded</span>
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
          <p className="eyebrow">Pending</p>
          <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.3rem' }}>
            Yet to Grade
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
