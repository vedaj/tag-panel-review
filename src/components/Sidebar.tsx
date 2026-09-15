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

  const NavLinks = ({ onNav, forceOpen }: { onNav?: () => void; forceOpen?: boolean }) => (
    <div className="nav-group">
      {visibleItems.map((item) => {
        const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
        const showLabel = forceOpen ?? open
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNav}
            className={`nav-item${active ? ' active' : ''}`}
            title={!showLabel ? item.label : undefined}
          >
            <span className="nav-item-icon">
              <item.icon size={18} />
            </span>
            {showLabel && <span className="nav-label">{item.label}</span>}
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
        <div className="brand-block">
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 34, height: 34, borderRadius: 8, flexShrink: 0,
            background: 'hsl(var(--primary) / 0.12)',
            color: 'hsl(var(--primary))',
            boxShadow: '0 0 0 1px hsl(var(--primary) / 0.15)',
          }}>
            <GraduationCap size={17} />
          </span>
          {open && (
            <div style={{ minWidth: 0 }}>
              <h2 className="brand-mark">TAG Panel Review</h2>
              <p className="brand-caption">Data Science TAG</p>
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
            background: 'color-mix(in srgb, var(--sidebar) 96%, transparent)',
            borderRight: '1px solid hsl(var(--border) / 0.8)',
            backdropFilter: 'blur(20px)',
          }}>
            {/* Mobile drawer header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 34, height: 34, borderRadius: 8,
                  background: 'hsl(var(--primary) / 0.12)',
                  color: 'hsl(var(--primary))',
                  boxShadow: '0 0 0 1px hsl(var(--primary) / 0.15)',
                }}>
                  <GraduationCap size={17} />
                </span>
                <div>
                  <h2 className="brand-mark">TAG Panel Review</h2>
                  <p className="brand-caption">Data Science TAG</p>
                </div>
              </div>
              <button
                onClick={onMobileClose}
                style={{ padding: 6, background: 'transparent', border: 'none', cursor: 'pointer', color: 'hsl(var(--muted-foreground))' }}
              >
                <X size={18} />
              </button>
            </div>

            <nav style={{ padding: '4px 12px 20px' }}>
              <p className="sidebar-section-title">Navigation</p>
              <NavLinks onNav={onMobileClose} forceOpen />
            </nav>
          </div>
          <div style={{ flex: 1, background: 'rgba(0,0,0,0.4)' }} onClick={onMobileClose} />
        </div>
      )}
    </>
  )
}
