'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Group, Profile } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, CheckCircle2, Circle, Loader2, RefreshCw, UserCheck } from 'lucide-react'

type Tab = 'panel' | 'guide'

export default function AssignmentsPage() {
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('panel')
  const [groups, setGroups] = useState<Group[]>([])
  const [faculty, setFaculty] = useState<Profile[]>([])
  // panel: groupId -> Set<facultyId>
  const [panelAssignments, setPanelAssignments] = useState<Map<string, Set<string>>>(new Map())
  // guide: groupId -> { guide1_id, guide2_id }
  const [guideAssignments, setGuideAssignments] = useState<Map<string, { guide1_id: string | null; guide2_id: string | null }>>(new Map())
  const [saving, setSaving] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    let tagId: string | null = null
    if (user) {
      const { data: profile } = await supabase.from('profiles').select('tag_id, role').eq('id', user.id).single()
      if (profile?.role !== 'institution_admin') tagId = profile?.tag_id ?? null
    }

    let groupsQ = supabase.from('groups').select('*').order('name')
    let facultyQ = supabase.from('profiles').select('*').eq('role', 'faculty').order('name')
    if (tagId) { groupsQ = groupsQ.eq('tag_id', tagId); facultyQ = facultyQ.eq('tag_id', tagId) }

    const [{ data: g }, { data: f }, { data: pa }] = await Promise.all([
      groupsQ,
      facultyQ,
      supabase.from('panel_assignments').select('*'),
    ])

    setGroups(g ?? [])
    setFaculty(f ?? [])

    const pMap = new Map<string, Set<string>>()
    for (const a of pa ?? []) {
      if (!pMap.has(a.group_id)) pMap.set(a.group_id, new Set())
      pMap.get(a.group_id)!.add(a.faculty_id)
    }
    setPanelAssignments(pMap)

    const gMap = new Map<string, { guide1_id: string | null; guide2_id: string | null }>()
    for (const grp of g ?? []) {
      gMap.set(grp.id, { guide1_id: grp.guide1_id ?? null, guide2_id: grp.guide2_id ?? null })
    }
    setGuideAssignments(gMap)

    setLoading(false)
  }

  // ── Panel toggle ──────────────────────────────────────────────
  async function togglePanel(groupId: string, facultyId: string) {
    const key = `panel:${groupId}:${facultyId}`
    setSaving(key)
    const current = panelAssignments.get(groupId) ?? new Set()
    if (current.has(facultyId)) {
      await supabase.from('panel_assignments').delete().eq('group_id', groupId).eq('faculty_id', facultyId)
      const next = new Map(panelAssignments)
      const s = new Set(next.get(groupId)!)
      s.delete(facultyId)
      next.set(groupId, s)
      setPanelAssignments(next)
    } else {
      await supabase.from('panel_assignments').insert({ group_id: groupId, faculty_id: facultyId })
      const next = new Map(panelAssignments)
      const s = new Set(next.get(groupId) ?? [])
      s.add(facultyId)
      next.set(groupId, s)
      setPanelAssignments(next)
    }
    setSaving(null)
  }

  // ── Guide set ─────────────────────────────────────────────────
  async function setGuide(groupId: string, slot: 'guide1_id' | 'guide2_id', facultyId: string | null) {
    const key = `guide:${groupId}:${slot}`
    setSaving(key)
    const { error } = await supabase.from('groups').update({ [slot]: facultyId || null }).eq('id', groupId)
    if (!error) {
      setGuideAssignments((prev) => {
        const next = new Map(prev)
        const current = next.get(groupId) ?? { guide1_id: null, guide2_id: null }
        next.set(groupId, { ...current, [slot]: facultyId || null })
        return next
      })
    }
    setSaving(null)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 pt-20 md:pt-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Assignments</h1>
          <p className="text-muted-foreground">Assign faculty to groups for panel and guide review.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw size={14} />Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'hsl(var(--muted))', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['panel', 'guide'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
              background: tab === t ? 'hsl(var(--card))' : 'transparent',
              color: tab === t ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              boxShadow: tab === t ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t === 'panel' ? 'Panel Assignments' : 'Guide Assignments'}
          </button>
        ))}
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No groups found. Import students first.
          </CardContent>
        </Card>
      )}

      {/* ── Panel tab ── */}
      {tab === 'panel' && (
        <div className="space-y-6">
          {groups.map((group) => {
            const assignedIds = panelAssignments.get(group.id) ?? new Set()
            return (
              <Card key={group.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      {group.project_title && <CardDescription className="mt-0.5">{group.project_title}</CardDescription>}
                    </div>
                    <Badge variant="secondary" className="gap-1">
                      <Users size={12} />{assignedIds.size} assigned
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {faculty.map((fac) => {
                      const isAssigned = assignedIds.has(fac.id)
                      const key = `panel:${group.id}:${fac.id}`
                      const isSaving = saving === key
                      return (
                        <button
                          key={fac.id}
                          onClick={() => togglePanel(group.id, fac.id)}
                          disabled={!!saving}
                          className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-sm ${
                            isAssigned
                              ? 'border-primary bg-primary/5 text-primary'
                              : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                          }`}
                        >
                          {isSaving ? <Loader2 size={16} className="animate-spin flex-shrink-0" />
                            : isAssigned ? <CheckCircle2 size={16} className="flex-shrink-0 text-primary" />
                            : <Circle size={16} className="flex-shrink-0" />}
                          <div className="min-w-0">
                            <p className="font-medium truncate">{fac.name}</p>
                            <p className="text-xs truncate opacity-70">{fac.email}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {/* ── Guide tab ── */}
      {tab === 'guide' && (
        <div className="space-y-6">
          {groups.map((group) => {
            const ga = guideAssignments.get(group.id) ?? { guide1_id: null, guide2_id: null }
            const guide1 = faculty.find((f) => f.id === ga.guide1_id)
            const guide2 = faculty.find((f) => f.id === ga.guide2_id)
            const savingGuide = saving?.startsWith(`guide:${group.id}:`)

            return (
              <Card key={group.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{group.name}</CardTitle>
                      {group.project_title && <CardDescription className="mt-0.5">{group.project_title}</CardDescription>}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {savingGuide && <Loader2 size={14} className="animate-spin text-muted-foreground" />}
                      <Badge variant={ga.guide1_id ? 'default' : 'secondary'} className="gap-1">
                        <UserCheck size={12} />
                        {ga.guide1_id ? 'Guide assigned' : 'No guide'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Primary guide */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Primary Guide
                      </label>
                      <select
                        value={ga.guide1_id ?? ''}
                        disabled={!!saving}
                        onChange={(e) => setGuide(group.id, 'guide1_id', e.target.value || null)}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 8,
                          border: '1px solid hsl(var(--border))',
                          background: 'hsl(var(--background))', color: 'hsl(var(--foreground))',
                          fontSize: '0.875rem', outline: 'none', cursor: 'pointer',
                        }}
                      >
                        <option value="">— None —</option>
                        {faculty.map((f) => (
                          <option key={f.id} value={f.id} disabled={f.id === ga.guide2_id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      {guide1 && (
                        <p style={{ marginTop: 4, fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{guide1.email}</p>
                      )}
                    </div>

                    {/* Secondary guide */}
                    <div>
                      <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'hsl(var(--muted-foreground))', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Secondary Guide <span style={{ fontWeight: 400, textTransform: 'none', letterSpacing: 0 }}>(optional)</span>
                      </label>
                      <select
                        value={ga.guide2_id ?? ''}
                        disabled={!!saving || !ga.guide1_id}
                        onChange={(e) => setGuide(group.id, 'guide2_id', e.target.value || null)}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: 8,
                          border: '1px solid hsl(var(--border))',
                          background: ga.guide1_id ? 'hsl(var(--background))' : 'hsl(var(--muted))',
                          color: 'hsl(var(--foreground))', fontSize: '0.875rem', outline: 'none',
                          cursor: ga.guide1_id ? 'pointer' : 'not-allowed', opacity: ga.guide1_id ? 1 : 0.5,
                        }}
                      >
                        <option value="">— None —</option>
                        {faculty.map((f) => (
                          <option key={f.id} value={f.id} disabled={f.id === ga.guide1_id}>
                            {f.name}
                          </option>
                        ))}
                      </select>
                      {guide2 && (
                        <p style={{ marginTop: 4, fontSize: '0.75rem', color: 'hsl(var(--muted-foreground))' }}>{guide2.email}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
