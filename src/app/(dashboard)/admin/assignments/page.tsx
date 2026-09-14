'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Group, Profile } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Users, CheckCircle2, Circle, Loader2, RefreshCw } from 'lucide-react'

export default function AssignmentsPage() {
  const supabase = createClient()

  const [groups, setGroups] = useState<Group[]>([])
  const [faculty, setFaculty] = useState<Profile[]>([])
  const [assignments, setAssignments] = useState<Map<string, Set<string>>>(new Map()) // groupId -> Set<facultyId>
  const [saving, setSaving] = useState<string | null>(null) // key being saved
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    const [{ data: g }, { data: f }, { data: a }] = await Promise.all([
      supabase.from('groups').select('*').order('name'),
      supabase.from('profiles').select('*').order('name'),
      supabase.from('panel_assignments').select('*'),
    ])

    setGroups(g ?? [])
    setFaculty(f ?? [])

    const map = new Map<string, Set<string>>()
    for (const ass of a ?? []) {
      if (!map.has(ass.group_id)) map.set(ass.group_id, new Set())
      map.get(ass.group_id)!.add(ass.faculty_id)
    }
    setAssignments(map)
    setLoading(false)
  }

  async function toggleAssignment(groupId: string, facultyId: string) {
    const key = `${groupId}:${facultyId}`
    setSaving(key)

    const currentSet = assignments.get(groupId) ?? new Set()
    const isAssigned = currentSet.has(facultyId)

    if (isAssigned) {
      await supabase
        .from('panel_assignments')
        .delete()
        .eq('group_id', groupId)
        .eq('faculty_id', facultyId)

      const next = new Map(assignments)
      const s = new Set(next.get(groupId)!)
      s.delete(facultyId)
      next.set(groupId, s)
      setAssignments(next)
    } else {
      await supabase.from('panel_assignments').insert({ group_id: groupId, faculty_id: facultyId })

      const next = new Map(assignments)
      const s = new Set(next.get(groupId) ?? [])
      s.add(facultyId)
      next.set(groupId, s)
      setAssignments(next)
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
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Panel Assignments</h1>
          <p className="text-muted-foreground">Assign faculty members to review each group.</p>
        </div>
        <Button variant="outline" size="sm" onClick={loadData} className="gap-2">
          <RefreshCw size={14} />
          Refresh
        </Button>
      </div>

      {groups.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No groups found. Import students first.
          </CardContent>
        </Card>
      )}

      <div className="space-y-6">
        {groups.map((group) => {
          const assignedIds = assignments.get(group.id) ?? new Set()

          return (
            <Card key={group.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{group.name}</CardTitle>
                    {group.project_title && (
                      <CardDescription className="mt-0.5">{group.project_title}</CardDescription>
                    )}
                  </div>
                  <Badge variant="secondary" className="gap-1">
                    <Users size={12} />
                    {assignedIds.size} assigned
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {faculty.map((fac) => {
                    const isAssigned = assignedIds.has(fac.id)
                    const key = `${group.id}:${fac.id}`
                    const isSaving = saving === key

                    return (
                      <button
                        key={fac.id}
                        onClick={() => toggleAssignment(group.id, fac.id)}
                        disabled={!!saving}
                        className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all text-sm ${
                          isAssigned
                            ? 'border-primary bg-primary/5 text-primary'
                            : 'border-border bg-background text-muted-foreground hover:border-primary/50 hover:text-foreground'
                        }`}
                      >
                        {isSaving ? (
                          <Loader2 size={16} className="animate-spin flex-shrink-0" />
                        ) : isAssigned ? (
                          <CheckCircle2 size={16} className="flex-shrink-0 text-primary" />
                        ) : (
                          <Circle size={16} className="flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="font-medium truncate">{fac.name}</p>
                          <p className="text-xs truncate opacity-70">{fac.role}</p>
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
    </div>
  )
}
