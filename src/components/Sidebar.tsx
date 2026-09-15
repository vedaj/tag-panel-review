'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { Profile } from '@/types/database'
import {
  GraduationCap,
  LayoutDashboard,
  BarChart2,
  Upload,
  BookOpen,
  FileText,
  Users as UsersIcon,
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
  { label: 'Analytics', caption: 'Performance insights', href: '/analytics', icon: BarChart2 },
  { label: 'Import Data', caption: 'Upload student data', href: '/admin/import', icon: Upload, adminOnly: true },
  { label: 'Rubrics', caption: 'Manage grading criteria', href: '/admin/rubrics', icon: BookOpen, adminOnly: true },
  { label: 'Report', caption: 'Download grade report', href: '/admin/report', icon: FileText, adminOnly: true },
  { label: 'Users', caption: 'Manage faculty accounts', href: '/admin/users', icon: UsersIcon, adminOnly: true },
]

interface SidebarProps {
  profile: Profile | null
  open: boolean
  mobileOpen: boolean
  onMobileToggle: () => void
  onMobileClose: () => void
}

export function Sidebar({ profile, open, mobileOpen, onMobileClose }: SidebarProps) {
  const pathname = usePathname()
  const isAdmin = profile?.role === 'admin'
  const visibleItems = navItems.filter((item) => !item.adminOnly || isAdmin)

  const NavLinks = ({ onNav }: { onNav?: () => void }) => (
    <div className="nav-group">
      {visibleItems.map((item) => {
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNav}
            className={`nav-item${active ? ' active' : ''}`}
            title={!open ? item.label : undefined}
          >
            <div className="nav-item-head">
              <span className="nav-item-icon">
                <item.icon size={15} />
              </span>
              {open && <strong>{item.label}</strong>}
            </div>
            {open && <span className="nav-caption">{item.caption}</span>}
          </Link>
        )
      })}
    </div>
  )

  return (
    <>
      {/* Desktop sidebar */}
      <aside className={`sidebar${open ? '' : ' sidebar-collapsed'}`}>
        {/* Brand block */}
        <div className="brand-block" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 32, height: 32, borderRadius: 8, flexShrink: 0,
            background: 'hsl(var(--primary) / 0.12)',
            color: 'hsl(var(--primary))',
            boxShadow: '0 0 0 1px hsl(var(--primary) / 0.15)',
          }}>
            <GraduationCap size={16} />
          </span>
          {open && (
            <div>
              <p className="eyebrow" style={{ fontSize: '0.68rem' }}>Data Science TAG</p>
              <h2 className="brand-mark" style={{ fontSize: '1.1rem', margin: 0 }}>TAG Panel Review</h2>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="nav-section">
          {open && <p className="sidebar-section-title">Navigation</p>}
          <NavLinks />
        </nav>
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex' }}>
          <div style={{
            width: 280, overflowY: 'auto',
            background: 'linear-gradient(180deg, var(--sidebar), var(--sidebar-accent))',
            borderRight: '1px solid var(--sidebar-border)',
            padding: 20, display: 'grid', gap: 20, alignContent: 'start',
          }}>
            {/* Mobile drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 32, height: 32, borderRadius: 8,
                  background: 'hsl(var(--primary) / 0.12)',
                  color: 'hsl(var(--primary))',
                  boxShadow: '0 0 0 1px hsl(var(--primary) / 0.15)',
                }}>
                  <GraduationCap size={16} />
                </span>
                <div>
                  <p className="eyebrow" style={{ fontSize: '0.68rem' }}>Data Science TAG</p>
                  <h2 className="brand-mark" style={{ fontSize: '1.1rem', margin: 0 }}>TAG Panel Review</h2>
                </div>
              </div>
              <button
                onClick={onMobileClose}
                style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--sidebar-foreground)' }}
              >
                <X size={18} />
              </button>
            </div>

            <nav className="nav-section">
              <p className="sidebar-section-title">Navigation</p>
              <NavLinks onNav={onMobileClose} />
            </nav>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} onClick={onMobileClose} />
        </div>
      )}
    </>
  )
}
