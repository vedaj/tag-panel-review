import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { effectiveTagFilter } from '@/lib/admin-scope'
import Link from 'next/link'
import { ClipboardList, Users, CheckCircle2, XCircle, ChevronRight, Building2, GraduationCap, TrendingUp, BookOpen, Clock } from 'lucide-react'

function ApprovalBadge({ approved }: { approved: boolean }) {
  return approved ? (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: '#f0fdf4', color: '#16a34a',
      border: '1px solid #bbf7d0',
      fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
    }}>
      <CheckCircle2 size={11} />Guide approved
    </span>
  ) : (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 4,
      padding: '2px 8px', borderRadius: 999,
      background: '#fef2f2', color: '#dc2626',
      border: '1px solid #fecaca',
      fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
    }}>
      <XCircle size={11} />Pending guide
    </span>
  )
}

function GroupCard({ group, gradedStudentIds, guideApproved }: {
  group: { id: string; name: string; project_title?: string; students?: { id: string; name: string }[]; guide_approval_status?: string }
  gradedStudentIds: Set<string>
  guideApproved?: boolean
}) {
  const studentIds = group.students?.map((s) => s.id) ?? []
  const gradedCount = studentIds.filter((id) => gradedStudentIds.has(id)).length
  const total = studentIds.length
  const done = gradedCount === total && total > 0
  const pct = total > 0 ? (gradedCount / total) * 100 : 0
  const showApproval = guideApproved !== undefined

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
      <div className="group-card-meta" style={{ justifyContent: 'space-between' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <Users size={13} />
          {total} student{total !== 1 ? 's' : ''}
        </span>
        {showApproval && <ApprovalBadge approved={guideApproved!} />}
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

  const numSort = (a: { name: string }, b: { name: string }) =>
    a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

  // Panel groups (from panel_assignments)
  let panelGroupsQuery = supabase
    .from('groups')
    .select(`*, students(id, name, roll_number)`)
  if (!isAdmin && tagId) panelGroupsQuery = panelGroupsQuery.eq('tag_id', tagId)
  if (!isAdmin) {
    // faculty: only groups they're assigned to
    const { data: assignments } = await supabase
      .from('panel_assignments')
      .select('group_id')
      .eq('faculty_id', user!.id)
    const assignedIds = (assignments ?? []).map((a: { group_id: string }) => a.group_id)
    if (assignedIds.length > 0) {
      panelGroupsQuery = panelGroupsQuery.in('id', assignedIds)
    } else if (!isAdmin) {
      panelGroupsQuery = panelGroupsQuery.in('id', [])
    }
  } else if (tagId) {
    panelGroupsQuery = panelGroupsQuery.eq('tag_id', tagId)
  }
  const { data: panelGroupsRaw } = await panelGroupsQuery
  const panelGroups = (panelGroupsRaw ?? []).sort(numSort)

  // Guide groups (where this user is guide1_id or guide2_id)
  const { data: guideGroupsRaw } = await supabase
    .from('groups')
    .select(`*, students(id, name, roll_number)`)
    .or(`guide1_id.eq.${user!.id},guide2_id.eq.${user!.id}`)
  const guideGroups = (guideGroupsRaw ?? []).sort(numSort)
  const isGuide = guideGroups.length > 0

  const { data: myPanelGrades } = await supabase
    .from('grades')
    .select('student_id, criteria_id')
    .eq('faculty_id', user!.id)
    .gt('marks', 0)

  const { data: guideGrades } = await supabase
    .from('grades')
    .select('student_id, criteria_id')
    .eq('faculty_id', user!.id)
    .gt('marks', 0)

  // Separate panel vs guide graded sets by criteria review_type
  const { data: allCriteria } = await supabase.from('criteria').select('id, review_type')
  const guideCriteriaIds = new Set((allCriteria ?? []).filter((c: { review_type: string }) => c.review_type === 'guide').map((c: { id: string }) => c.id))

  const panelGradedIds = new Set(
    (myPanelGrades ?? []).filter((g: { criteria_id: string }) => !guideCriteriaIds.has(g.criteria_id)).map((g: { student_id: string }) => g.student_id)
  )
  const guideGradedIds = new Set(
    (guideGrades ?? []).filter((g: { criteria_id: string }) => guideCriteriaIds.has(g.criteria_id)).map((g: { student_id: string }) => g.student_id)
  )

  const totalStudents = panelGroups.reduce((sum, g) => sum + (g.students?.length ?? 0), 0)

  // Panel queues split by guide approval
  const approvedPanelGroups = panelGroups.filter((g) => g.guide_approval_status === 'approved')
  const pendingApprovalGroups = panelGroups.filter((g) => g.guide_approval_status !== 'approved')

  const panelPendingGroups = approvedPanelGroups.filter((g) => {
    const ids = g.students?.map((s: { id: string }) => s.id) ?? []
    return ids.length === 0 || ids.some((id: string) => !panelGradedIds.has(id))
  })
  const panelCompletedGroups = approvedPanelGroups.filter((g) => {
    const ids = g.students?.map((s: { id: string }) => s.id) ?? []
    return ids.length > 0 && ids.every((id: string) => panelGradedIds.has(id))
  })

  const scopeLabel = isAdmin
    ? `${(profile?.tag as { short_name?: string } | null)?.short_name ?? ''} TAG — admin view`
    : isGuide && panelGroups.length > 0
      ? 'Guide & panel member'
      : isGuide
        ? 'Guide review'
        : 'Panel review'

  return (
    <>
      <div className="dashboard-topbar">
        <p className="eyebrow">Dashboard</p>
        <h1 className="section-title" style={{ marginTop: 6 }}>Welcome, {profile?.name}</h1>
        <p className="section-subtitle">{scopeLabel}</p>
      </div>

      <div className="dashboard-section">
        <p className="eyebrow">At a glance</p>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon"><ClipboardList size={18} /></div>
            <span className="stat-value">{panelGroups.length + (isGuide ? guideGroups.length : 0)}</span>
            <span className="stat-label">Groups</span>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Users size={18} /></div>
            <span className="stat-value">{totalStudents}</span>
            <span className="stat-label">Students</span>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><CheckCircle2 size={18} /></div>
            <span className="stat-value">{panelGradedIds.size}</span>
            <span className="stat-label">Panel Graded</span>
          </div>
          {isGuide && (
            <div className="stat-card">
              <div className="stat-icon"><BookOpen size={18} /></div>
              <span className="stat-value">{guideGroups.filter((g) => g.guide_approval_status === 'approved').length}/{guideGroups.length}</span>
              <span className="stat-label">Guide Approved</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Guide section ── */}
      {isGuide && (
        <>
          <div className="dashboard-section">
            <p className="eyebrow">Guide review</p>
            <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.3rem' }}>
              Your guide groups
              <span style={{ marginLeft: 10, fontSize: '0.85rem', fontFamily: 'var(--body-font)', fontWeight: 500, color: 'var(--app-hero-subtext)', letterSpacing: 0 }}>
                {guideGroups.length} group{guideGroups.length !== 1 ? 's' : ''}
              </span>
            </h2>
            <div className="group-grid">
              {guideGroups.map((group) => {
                const ids = group.students?.map((s: { id: string }) => s.id) ?? []
                const gradedCount = ids.filter((id: string) => guideGradedIds.has(id)).length
                const approved = group.guide_approval_status === 'approved'
                return (
                  <Link key={group.id} href={`/guide/${group.id}`} className="group-card">
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <span className="group-card-name">{group.name}</span>
                      <span className={`group-badge${approved ? ' done' : ''}`}>
                        {approved ? 'Approved' : `${gradedCount}/${ids.length}`}
                      </span>
                    </div>
                    {group.project_title && <p className="group-card-title">{group.project_title}</p>}
                    <div className="group-card-meta" style={{ gap: 12 }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={13} />{ids.length} student{ids.length !== 1 ? 's' : ''}</span>
                      {approved
                        ? <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: '#16a34a', fontSize: '0.72rem', fontWeight: 600 }}><CheckCircle2 size={12} />Approved for panel</span>
                        : <span style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'hsl(var(--muted-foreground))', fontSize: '0.72rem' }}><Clock size={12} />Pending approval</span>
                      }
                    </div>
                    <div className="group-progress-row">
                      <div className="group-progress-bar">
                        <div className="group-progress-fill" style={{ width: `${ids.length > 0 ? (gradedCount / ids.length) * 100 : 0}%` }} />
                      </div>
                      <ChevronRight size={15} style={{ color: 'var(--app-hero-subtext)', flexShrink: 0 }} />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── Panel section ── */}
      {panelGroups.length > 0 && (
        <>
          {/* Approved — ready for panel review */}
          {panelPendingGroups.length > 0 && (
            <div className="dashboard-section">
              <p className="eyebrow">Panel review</p>
              <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.3rem' }}>
                Ready to review
                <span style={{ marginLeft: 10, fontSize: '0.85rem', fontFamily: 'var(--body-font)', fontWeight: 500, color: 'var(--app-hero-subtext)', letterSpacing: 0 }}>
                  {panelPendingGroups.length} group{panelPendingGroups.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <div className="group-grid">
                {panelPendingGroups.map((group) => <GroupCard key={group.id} group={group} gradedStudentIds={panelGradedIds} guideApproved={true} />)}
              </div>
            </div>
          )}

          {panelCompletedGroups.length > 0 && (
            <div className="dashboard-section">
              <p className="eyebrow" style={{ color: '#166534' }}>Completed</p>
              <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.3rem' }}>
                Panel graded
                <span style={{ marginLeft: 10, fontSize: '0.85rem', fontFamily: 'var(--body-font)', fontWeight: 500, color: 'var(--app-hero-subtext)', letterSpacing: 0 }}>
                  {panelCompletedGroups.length} group{panelCompletedGroups.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <div className="group-grid">
                {panelCompletedGroups.map((group) => <GroupCard key={group.id} group={group} gradedStudentIds={panelGradedIds} guideApproved={true} />)}
              </div>
            </div>
          )}

          {/* Waiting for guide approval */}
          {pendingApprovalGroups.length > 0 && (
            <div className="dashboard-section">
              <p className="eyebrow" style={{ color: '#92400e' }}>Waiting</p>
              <h2 className="section-title" style={{ marginTop: 4, fontSize: '1.3rem' }}>
                Pending guide approval
                <span style={{ marginLeft: 10, fontSize: '0.85rem', fontFamily: 'var(--body-font)', fontWeight: 500, color: 'var(--app-hero-subtext)', letterSpacing: 0 }}>
                  {pendingApprovalGroups.length} group{pendingApprovalGroups.length !== 1 ? 's' : ''}
                </span>
              </h2>
              <div className="group-grid">
                {pendingApprovalGroups.map((group) => (
                  <div key={group.id} className="group-card" style={{ opacity: 0.55, cursor: 'default' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                      <span className="group-card-name">{group.name}</span>
                      <span className={`group-badge`}>{group.students?.length ?? 0} students</span>
                    </div>
                    {group.project_title && <p className="group-card-title">{group.project_title}</p>}
                    <div className="group-card-meta" style={{ justifyContent: 'space-between' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}><Users size={13} />{group.students?.length ?? 0} student{(group.students?.length ?? 0) !== 1 ? 's' : ''}</span>
                      <ApprovalBadge approved={false} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {panelGroups.length === 0 && !isGuide && (
        <div className="dashboard-section">
          <p className="section-subtitle">No groups assigned yet.</p>
        </div>
      )}
    </>
  )
}
