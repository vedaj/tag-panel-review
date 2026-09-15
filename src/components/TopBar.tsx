'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { PanelLeftClose, PanelLeftOpen, Menu, LogOut, GraduationCap, Sun, Moon } from 'lucide-react'
import { createClient } from '@/lib/supabase'
import type { Profile } from '@/types/database'

type Theme = 'light' | 'dark'
type FontMode = 'serif' | 'sans'

export function TopBar({
  profile,
  sidebarOpen,
  onDesktopToggle,
  onMobileToggle,
}: {
  profile: Profile | null
  sidebarOpen: boolean
  onDesktopToggle: () => void
  onMobileToggle: () => void
}) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('light')
  const [fontMode, setFontMode] = useState<FontMode>('serif')
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    // Sync state from what the anti-flash script already applied
    try {
      const t = localStorage.getItem('tag:theme') as Theme | null
      const f = localStorage.getItem('tag:font') as FontMode | null
      if (t) setTheme(t)
      if (f) setFontMode(f)
    } catch {}
  }, [])

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', onClickOutside)
    return () => document.removeEventListener('mousedown', onClickOutside)
  }, [])

  function applyTheme(t: Theme) {
    setTheme(t)
    try { localStorage.setItem('tag:theme', t) } catch {}
    document.documentElement.classList.toggle('dark', t === 'dark')
  }

  function applyFont(f: FontMode) {
    setFontMode(f)
    try { localStorage.setItem('tag:font', f) } catch {}
    document.documentElement.classList.toggle('font-sans-ui', f === 'sans')
  }

  async function handleSignOut() {
    setMenuOpen(false)
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const initials = profile?.name
    ? profile.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase()
    : '?'

  return (
    <div className="content-topbar">
      {/* Mobile: open drawer */}
      <button className="topbar-icon-btn mobile-only" onClick={onMobileToggle} title="Open menu">
        <Menu size={18} />
      </button>

      {/* Mobile: brand */}
      <div className="topbar-brand mobile-only">
        <span className="topbar-brand-icon">
          <GraduationCap size={15} />
        </span>
        <span className="topbar-brand-name">TAG Panel Review</span>
      </div>

      {/* Desktop: sidebar collapse toggle */}
      <button
        className="topbar-icon-btn desktop-only"
        onClick={onDesktopToggle}
        title={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
      >
        {sidebarOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
      </button>

      {/* User menu — always visible */}
      <div style={{ position: 'relative', marginLeft: 'auto' }} ref={menuRef}>
        <button className="user-menu-pill" onClick={() => setMenuOpen((v) => !v)}>
          <span className="user-avatar-ring">
            <span className="user-avatar-initials">{initials}</span>
          </span>
          <span className="user-menu-info desktop-only">
            <span className="user-menu-name">{profile?.name ?? 'Faculty'}</span>
            <span className="user-menu-role">{profile?.role}</span>
          </span>
        </button>

        {menuOpen && (
          <div className="user-menu-dropdown">
            {/* Profile header */}
            <div className="user-menu-header">
              <span className="user-avatar-ring user-avatar-ring-lg">
                <span className="user-avatar-initials user-avatar-initials-lg">{initials}</span>
              </span>
              <div style={{ minWidth: 0 }}>
                <p className="user-menu-fullname">{profile?.name}</p>
                <p className="user-menu-badge">{profile?.role}</p>
              </div>
            </div>

            <div className="user-menu-divider" />

            {/* Preferences */}
            <div className="user-menu-pref-section">
              {/* Theme */}
              <div className="user-menu-pref-row">
                <span className="user-menu-pref-label">Theme</span>
                <div className="user-menu-pref-control">
                  <button
                    className={`pref-btn${theme === 'light' ? ' pref-btn-active' : ''}`}
                    onClick={() => applyTheme('light')}
                    title="Light"
                  >
                    <Sun size={13} />
                  </button>
                  <button
                    className={`pref-btn${theme === 'dark' ? ' pref-btn-active' : ''}`}
                    onClick={() => applyTheme('dark')}
                    title="Dark"
                  >
                    <Moon size={13} />
                  </button>
                </div>
              </div>

              {/* Font */}
              <div className="user-menu-pref-row">
                <span className="user-menu-pref-label">Font</span>
                <div className="user-menu-pref-control">
                  <button
                    className={`pref-btn pref-btn-serif${fontMode === 'serif' ? ' pref-btn-active' : ''}`}
                    onClick={() => applyFont('serif')}
                    title="Serif"
                  >
                    Aa
                  </button>
                  <button
                    className={`pref-btn pref-btn-sans${fontMode === 'sans' ? ' pref-btn-active' : ''}`}
                    onClick={() => applyFont('sans')}
                    title="Sans-serif"
                  >
                    Aa
                  </button>
                </div>
              </div>
            </div>

            <div className="user-menu-divider" />

            {/* Sign out */}
            <div className="user-menu-actions">
              <button className="user-menu-item" onClick={handleSignOut}>
                <LogOut size={14} />
                Sign out
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
