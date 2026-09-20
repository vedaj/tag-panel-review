export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { Building2, Users, ClipboardList, GraduationCap } from 'lucide-react'

interface TagStats {
  id: string
  name: string
  short_name: string
  faculty: number
  admins: number
  groups: number
}

export default async function InstitutionPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'institution_admin') redirect('/dashboard')

  const admin = createAdminSupabaseClient()
  const [{ data: tags }, { data: profiles }, { data: groups }] = await Promise.all([
    admin.from('tags').select('*').order('short_name'),
    admin.from('profiles').select('tag_id, role'),
    admin.from('groups').select('id, tag_id'),
  ])

  const tagStats: TagStats[] = (tags ?? []).map((tag) => {
    const tagProfiles = (profiles ?? []).filter((p: { tag_id: string | null; role: string }) => p.tag_id === tag.id)
    const tagGroups = (groups ?? []).filter((g: { tag_id: string | null }) => g.tag_id === tag.id)
    return {
      id: tag.id,
      name: tag.name,
      short_name: tag.short_name,
      faculty: tagProfiles.filter((p) => p.role === 'faculty').length,
      admins: tagProfiles.filter((p) => p.role === 'admin' || p.role === 'institution_admin').length,
      groups: tagGroups.length,
      students: 0,
    }
  })

  const totals = tagStats.reduce(
    (acc, t) => ({
      faculty: acc.faculty + t.faculty,
      admins: acc.admins + t.admins,
      groups: acc.groups + t.groups,
    }),
    { faculty: 0, admins: 0, groups: 0 }
  )

  return (
    <div style={{ padding: '0 0 48px' }}>
      <div className="dashboard-topbar">
        <p className="eyebrow">Institution Admin</p>
        <h1 className="section-title" style={{ marginTop: 6 }}>All TAGs</h1>
        <p className="section-subtitle">Overview across all {tags?.length ?? 0} Technology Advancement Groups</p>
      </div>

      {/* Institution totals */}
      <div className="dashboard-section">
        <p className="eyebrow">At a glance</p>
        <div className="stat-grid">
          <div className="stat-card">
            <div className="stat-icon"><Building2 size={18} /></div>
            <span className="stat-value">{tags?.length ?? 0}</span>
            <span className="stat-label">TAGs</span>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><Users size={18} /></div>
            <span className="stat-value">{totals.faculty + totals.admins}</span>
            <span className="stat-label">Faculty</span>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><ClipboardList size={18} /></div>
            <span className="stat-value">{totals.groups}</span>
            <span className="stat-label">Groups</span>
          </div>
          <div className="stat-card">
            <div className="stat-icon"><GraduationCap size={18} /></div>
            <span className="stat-value">{totals.admins}</span>
            <span className="stat-label">Admins</span>
          </div>
        </div>
      </div>

      {/* Per-TAG cards */}
      <div className="dashboard-section">
        <p className="eyebrow">TAG breakdown</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16, marginTop: 12 }}>
          {tagStats.map((tag) => (
            <div
              key={tag.id}
              style={{
                background: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'calc(var(--radius) * 1.5)',
                padding: '20px 24px',
                boxShadow: 'var(--shadow-md)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  <span style={{
                    display: 'inline-block', padding: '3px 10px', borderRadius: 999,
                    fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em',
                    background: 'hsl(var(--primary) / 0.1)', color: 'hsl(var(--primary))',
                    border: '1px solid hsl(var(--primary) / 0.2)', marginBottom: 8,
                  }}>
                    {tag.short_name}
                  </span>
                  <p style={{ margin: 0, fontSize: '0.88rem', fontWeight: 600, color: 'var(--app-hero-text)', lineHeight: 1.35 }}>{tag.name}</p>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 16 }}>
                {[
                  { label: 'Admins', value: tag.admins, icon: <Shield size={14} /> },
                  { label: 'Faculty', value: tag.faculty, icon: <Users size={14} /> },
                  { label: 'Groups', value: tag.groups, icon: <ClipboardList size={14} /> },
                ].map(({ label, value, icon }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--app-hero-text)', lineHeight: 1 }}>{value}</div>
                    <div style={{ fontSize: '0.7rem', color: 'hsl(var(--muted-foreground))', marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                      {icon} {label}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// Shield is not imported above, inline it
function Shield({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
    </svg>
  )
}
