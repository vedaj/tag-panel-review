'use client'
import { useState, useEffect } from 'react'
import type { Profile } from '@/types/database'
import { Sidebar } from './Sidebar'
import { TopBar } from './TopBar'

export function DashboardShell({
  profile,
  children,
}: {
  profile: Profile | null
  children: React.ReactNode
}) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    try {
      const v = localStorage.getItem('tag:sidebar-open')
      if (v !== null) setSidebarOpen(v !== 'false')
    } catch {}
  }, [])

  function toggleDesktop() {
    setSidebarOpen((prev) => {
      const next = !prev
      try { localStorage.setItem('tag:sidebar-open', String(next)) } catch {}
      return next
    })
  }

  return (
    <div
      className="app-shell"
      style={{ gridTemplateColumns: `${sidebarOpen ? '264px' : '72px'} minmax(0, 1fr)` }}
    >
      <Sidebar
        profile={profile}
        open={sidebarOpen}
        mobileOpen={mobileOpen}
        onMobileToggle={() => setMobileOpen((v) => !v)}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="content-column">
        <TopBar
          profile={profile}
          sidebarOpen={sidebarOpen}
          onDesktopToggle={toggleDesktop}
          onMobileToggle={() => setMobileOpen((v) => !v)}
        />
        {children}
      </div>
    </div>
  )
}
