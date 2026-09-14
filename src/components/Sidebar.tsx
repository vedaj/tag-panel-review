'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/types/database'
import {
  GraduationCap,
  LayoutDashboard,
  Upload,
  BookOpen,
  FileText,
  LogOut,
  Menu,
  X,
} from 'lucide-react'

interface NavItem {
  label: string
  caption: string
  href: string
  icon: React.ElementType
  adminOnly?: boolean
}

const navItems: NavItem[] = [
  { label: 'Dashboard', caption: 'Overview of your groups', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Import Data', caption: 'Upload student data', href: '/admin/import', icon: Upload, adminOnly: true },
  { label: 'Rubrics', caption: 'Manage grading criteria', href: '/admin/rubrics', icon: BookOpen, adminOnly: true },
  { label: 'Report', caption: 'Download grade report', href: '/admin/report', icon: FileText, adminOnly: true },
]

interface SidebarProps {
  profile: Profile | null
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const supabase = createClient()

  const isAdmin = profile?.role === 'admin'
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const NavContent = () => (
    <>
      <div className="brand-block">
        <p className="eyebrow">Data Science TAG</p>
        <h2 className="brand-mark">TAG Panel Review</h2>
        <p className="brand-caption">Dept. of CSE · School of Computing<br />Amrita Vishwa Vidyapeetham</p>
      </div>

      <nav className="nav-section">
        <p className="sidebar-section-title">Navigation</p>
        <div className="nav-group">
          {visibleItems.map((item) => {
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`nav-item${active ? ' active' : ''}`}
              >
                <div className="nav-item-head">
                  <span className="nav-item-icon">
                    <item.icon size={15} />
                  </span>
                  <strong>{item.label}</strong>
                </div>
                <span className="nav-caption">{item.caption}</span>
              </Link>
            )
          })}
        </div>
      </nav>

      <div className="sidebar-user">
        <div className="sidebar-user-row">
          <div className="sidebar-avatar">
            {profile?.name?.[0]?.toUpperCase() ?? '?'}
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="sidebar-user-name">{profile?.name ?? 'Faculty'}</p>
            <p className="sidebar-user-role">{profile?.role}</p>
          </div>
        </div>
        <button className="sidebar-signout" onClick={handleLogout}>
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </>
  )

  return (
    <>
      {/* Desktop sidebar — rendered in app-shell grid */}
      <aside className="sidebar">
        <NavContent />
      </aside>

      {/* Mobile top bar */}
      <div className="mobile-topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8,
            background: 'hsl(var(--primary))', color: 'hsl(var(--primary-foreground))',
          }}>
            <GraduationCap size={16} />
          </span>
          <span style={{ fontWeight: 600, fontSize: '0.92rem' }}>TAG Panel Review</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          style={{ padding: '6px', background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--app-hero-text)' }}
        >
          {mobileOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 40, display: 'flex' }}>
          <div style={{
            width: 280, marginTop: 56, overflowY: 'auto',
            background: 'linear-gradient(180deg, var(--sidebar), var(--sidebar-accent))',
            borderRight: '1px solid var(--sidebar-border)',
            padding: 20, display: 'grid', gap: 20, alignContent: 'start',
          }}>
            <NavContent />
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.3)' }} onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  )
}
