import { createServerSupabaseClient } from '@/lib/supabase-server'
import Link from 'next/link'
import { ClipboardList, Users, CheckCircle2, ChevronRight } from 'lucide-react'

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single()

  const isAdmin = profile?.role === 'admin'

  const groupsQuery = supabase
    .from('groups')
    .select(`*, students(id, name, roll_number)`)
    .order('name')

  const { data: groups } = await groupsQuery

  const { data: myGrades } = await supabase
    .from('grades')
    .select('student_id')
    .eq('faculty_id', user!.id)

  const gradedStudentIds = new Set(myGrades?.map((g) => g.student_id) ?? [])
  const totalStudents = groups?.reduce((sum, g) => sum + (g.students?.length ?? 0), 0) ?? 0

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

      {/* Groups */}
      <div className="dashboard-section">
        <p className="eyebrow">Groups</p>
        <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.3rem' }}>
          {isAdmin ? 'All Groups' : 'Your Assignments'}
        </h2>

        {(!groups || groups.length === 0) && (
          <p className="section-subtitle" style={{ marginTop: 16 }}>No groups found.</p>
        )}

        <div className="group-grid">
          {groups?.map((group) => {
            const studentIds = group.students?.map((s: { id: string }) => s.id) ?? []
            const gradedCount = studentIds.filter((id: string) => gradedStudentIds.has(id)).length
            const total = studentIds.length
            const done = gradedCount === total && total > 0
            const pct = total > 0 ? (gradedCount / total) * 100 : 0

            return (
              <Link key={group.id} href={`/grade/${group.id}`} className="group-card">
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
                  {group.guide1 && (
                    <span style={{ marginLeft: 4 }}>· {group.guide1}{group.guide2 ? `, ${group.guide2}` : ''}</span>
                  )}
                </div>
                <div className="group-progress-row">
                  <div className="group-progress-bar">
                    <div className="group-progress-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <ChevronRight size={15} style={{ color: 'var(--app-hero-subtext)', flexShrink: 0 }} />
                </div>
              </Link>
            )
          })}
        </div>
      </div>
    </>
  )
}
