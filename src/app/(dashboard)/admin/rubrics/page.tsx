'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Criteria, SubCriteria } from '@/types/database'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronRight, GripVertical } from 'lucide-react'
import type { ReviewType } from '@/types/database'

type CriteriaWithSub = Criteria & { sub_criteria: SubCriteria[] }
type Tab = 'panel' | 'guide'

const PROJECT_TYPE_OPTIONS = [
  { value: 'all',         label: 'All Types'        },
  { value: 'research',    label: 'Research Based'   },
  { value: 'application', label: 'Application Based'},
  { value: 'software',    label: 'Software Based'   },
]

export default function RubricsPage() {
  const supabase = createClient()
  const [activeTab, setActiveTab] = useState<Tab>('panel')
  const [criteria, setCriteria] = useState<CriteriaWithSub[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [savedMsg, setSavedMsg] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [callerTagId, setCallerTagId] = useState<string | null>(null)

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        const { data: profile } = await supabase.from('profiles').select('tag_id').eq('id', user.id).single()
        setCallerTagId(profile?.tag_id ?? null)
        await loadCriteria(profile?.tag_id ?? null)
      } else {
        await loadCriteria(null)
      }
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadCriteria(tagId?: string | null) {
    setLoading(true)
    let q = supabase
      .from('criteria')
      .select('*, sub_criteria(id, title, description, max_marks, order_index, criteria_id, allowed_marks)')
      .order('order_index')
    if (tagId) q = q.eq('tag_id', tagId)
    const { data } = await q

    if (data) {
      setCriteria(
        data.map((c) => ({
          ...c,
          project_type: c.project_type ?? 'all',
          allowed_marks: c.allowed_marks ?? '',
          review_type: (c.review_type ?? 'panel') as ReviewType,
          sub_criteria: (c.sub_criteria ?? [])
            .sort((a: SubCriteria, b: SubCriteria) => a.order_index - b.order_index)
            .map((s: SubCriteria) => ({ ...s, allowed_marks: s.allowed_marks ?? '' })),
        }))
      )
    }
    setLoading(false)
  }

  function updateCriteria(id: string, field: string, value: string | number) {
    setCriteria((prev) => prev.map((c) => (c.id === id ? { ...c, [field]: value } : c)))
  }

  function updateSubCriteria(criteriaId: string, subId: string, field: string, value: string | number) {
    setCriteria((prev) =>
      prev.map((c) =>
        c.id === criteriaId
          ? { ...c, sub_criteria: c.sub_criteria.map((s) => (s.id === subId ? { ...s, [field]: value } : s)) }
          : c
      )
    )
  }

  function addCriteria() {
    const id = crypto.randomUUID()
    setCriteria((prev) => [
      ...prev,
      { id, title: '', description: '', max_marks: 10, order_index: prev.length, project_type: 'all', allowed_marks: '', review_type: activeTab as ReviewType, created_at: '', sub_criteria: [] },
    ])
    setExpanded((prev) => new Set([...prev, id]))
  }

  function addSubCriteria(criteriaId: string) {
    const id = crypto.randomUUID()
    setCriteria((prev) =>
      prev.map((c) =>
        c.id === criteriaId
          ? { ...c, sub_criteria: [...c.sub_criteria, { id, criteria_id: criteriaId, title: '', description: '', max_marks: 5, order_index: c.sub_criteria.length, allowed_marks: '', created_at: '' }] }
          : c
      )
    )
  }

  async function handleSave() {
    setSaving(true)
    setSavedMsg('')
    try {
      const [{ data: dbCriteria }, { data: dbSubs }] = await Promise.all([
        supabase.from('criteria').select('id'),
        supabase.from('sub_criteria').select('id'),
      ])
      const dbCriteriaIds = new Set((dbCriteria ?? []).map((c: { id: string }) => c.id))
      const dbSubIds = new Set((dbSubs ?? []).map((s: { id: string }) => s.id))

      const currentCriteriaIds = new Set(criteria.map((c) => c.id))
      const currentSubIds = new Set(criteria.flatMap((c) => c.sub_criteria.map((s) => s.id)))

      const criteriaToDelete = [...dbCriteriaIds].filter((id) => !currentCriteriaIds.has(id))
      const subsToDelete = [...dbSubIds].filter((id) => !currentSubIds.has(id))

      await Promise.all([
        criteriaToDelete.length > 0 ? supabase.from('criteria').delete().in('id', criteriaToDelete) : Promise.resolve(),
        subsToDelete.length > 0 ? supabase.from('sub_criteria').delete().in('id', subsToDelete) : Promise.resolve(),
      ])

      // Assign order_index within each review_type separately
      const panelCriteria = criteria.filter((c) => c.review_type === 'panel')
      const guideCriteria = criteria.filter((c) => c.review_type === 'guide')
      const orderedCriteria = [
        ...panelCriteria.map((c, i) => ({ ...c, order_index: i })),
        ...guideCriteria.map((c, i) => ({ ...c, order_index: i })),
      ]

      const criteriaRows = orderedCriteria.map((c) => ({
        id: c.id,
        title: c.title,
        description: c.description,
        max_marks: c.max_marks,
        order_index: c.order_index,
        project_type: c.project_type,
        allowed_marks: c.allowed_marks,
        review_type: c.review_type,
        ...(callerTagId && !dbCriteriaIds.has(c.id) ? { tag_id: callerTagId } : {}),
      }))
      if (criteriaRows.length > 0) {
        const { error } = await supabase.from('criteria').upsert(criteriaRows, { onConflict: 'id' })
        if (error) throw error
      }

      const subRows = orderedCriteria.flatMap((c) =>
        c.sub_criteria.map((s, j) => ({
          id: s.id,
          criteria_id: c.id,
          title: s.title,
          description: s.description,
          max_marks: s.max_marks,
          order_index: j,
          allowed_marks: s.allowed_marks,
        }))
      )
      if (subRows.length > 0) {
        const { error } = await supabase.from('sub_criteria').upsert(subRows, { onConflict: 'id' })
        if (error) throw error
      }

      await loadCriteria(callerTagId)
      setSavedMsg('Saved!')
      setTimeout(() => setSavedMsg(''), 3000)
    } finally {
      setSaving(false)
    }
  }

  const visibleCriteria = criteria.filter((c) => c.review_type === activeTab)

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="p-6 md:p-8 pt-20 md:pt-8 max-w-3xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Admin</p>
          <h1 style={{ margin: 0, fontFamily: 'var(--title-font)', fontSize: '1.8rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)' }}>Rubrics</h1>
          <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.88rem', marginTop: 4 }}>
            Define criteria, max marks, and which mark values reviewers can award.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {savedMsg && <span className="text-sm text-green-600 font-medium">{savedMsg}</span>}
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <><Loader2 className="animate-spin" size={15} />Saving…</> : <><Save size={15} />Save All</>}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 24, background: 'hsl(var(--muted))', borderRadius: 10, padding: 4, width: 'fit-content' }}>
        {(['panel', 'guide'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '7px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
              fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
              background: activeTab === t ? 'hsl(var(--card))' : 'transparent',
              color: activeTab === t ? 'hsl(var(--foreground))' : 'hsl(var(--muted-foreground))',
              boxShadow: activeTab === t ? 'var(--shadow-sm)' : 'none',
            }}
          >
            {t === 'panel' ? 'Panel Rubrics' : 'Guide Rubrics'}
            <span style={{
              marginLeft: 7, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              minWidth: 18, height: 18, borderRadius: 999, fontSize: '0.7rem', fontWeight: 700,
              background: activeTab === t ? 'hsl(var(--primary) / 0.12)' : 'hsl(var(--border))',
              color: activeTab === t ? 'hsl(var(--primary))' : 'hsl(var(--muted-foreground))',
              padding: '0 5px',
            }}>
              {criteria.filter((c) => c.review_type === t).length}
            </span>
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visibleCriteria.map((crit) => (
          <Card key={crit.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start gap-3">
                <GripVertical size={16} className="text-muted-foreground mt-2 flex-shrink-0" />
                <div className="flex-1 space-y-3">
                  {/* Row 1: title + max marks + allowed marks + project type + delete */}
                  <div className="grid sm:grid-cols-[1fr_auto_auto_auto_auto] gap-3 items-end">
                    <div className="space-y-1">
                      <Label className="text-xs">Criterion Title</Label>
                      <Input
                        value={crit.title}
                        onChange={(e) => updateCriteria(crit.id, 'title', e.target.value)}
                        placeholder="e.g. Design & Architecture"
                      />
                    </div>
                    <div className="space-y-1 w-24">
                      <Label className="text-xs">Max Marks</Label>
                      <Input
                        type="number" min={0} step={0.5}
                        value={crit.max_marks}
                        onChange={(e) => updateCriteria(crit.id, 'max_marks', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1 w-32">
                      <Label className="text-xs">Allowed Marks</Label>
                      <Input
                        value={crit.allowed_marks}
                        onChange={(e) => updateCriteria(crit.id, 'allowed_marks', e.target.value)}
                        placeholder="0,3,5"
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1 w-44">
                      <Label className="text-xs">Project Type</Label>
                      <select
                        value={crit.project_type}
                        onChange={(e) => updateCriteria(crit.id, 'project_type', e.target.value)}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: '8px',
                          border: '1px solid hsl(var(--border))', background: 'hsl(var(--background))',
                          color: 'hsl(var(--foreground))', fontSize: '0.88rem',
                        }}
                      >
                        {PROJECT_TYPE_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                    <Button
                      variant="ghost" size="icon"
                      className="text-destructive hover:text-destructive mt-5"
                      onClick={() => setCriteria((prev) => prev.filter((c) => c.id !== crit.id))}
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                  {crit.allowed_marks && crit.sub_criteria.length === 0 && (
                    <p className="text-xs text-muted-foreground">
                      Reviewers pick from: {crit.allowed_marks.split(',').map(s => s.trim()).join(' · ')}
                    </p>
                  )}
                  <Textarea
                    value={crit.description}
                    onChange={(e) => updateCriteria(crit.id, 'description', e.target.value)}
                    placeholder="Description / guidance for graders (optional)"
                    rows={2}
                    className="text-sm"
                  />
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Button
                variant="ghost" size="sm"
                className="gap-1.5 text-muted-foreground mb-3"
                onClick={() =>
                  setExpanded((prev) => {
                    const next = new Set(prev)
                    if (next.has(crit.id)) next.delete(crit.id); else next.add(crit.id)
                    return next
                  })
                }
              >
                {expanded.has(crit.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                Sub-criteria ({crit.sub_criteria.length})
              </Button>

              {expanded.has(crit.id) && (
                <div className="pl-4 border-l space-y-4">
                  {crit.sub_criteria.map((sub) => (
                    <div key={sub.id} className="space-y-2">
                      <div className="grid sm:grid-cols-[1fr_auto_auto_auto] gap-3 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Sub-criterion Title</Label>
                          <Input
                            value={sub.title}
                            onChange={(e) => updateSubCriteria(crit.id, sub.id, 'title', e.target.value)}
                            placeholder="e.g. Software Architecture & Module Design"
                            className="text-sm"
                          />
                        </div>
                        <div className="space-y-1 w-24">
                          <Label className="text-xs">Max Marks</Label>
                          <Input
                            type="number" min={0} step={0.5}
                            value={sub.max_marks}
                            onChange={(e) => updateSubCriteria(crit.id, sub.id, 'max_marks', parseFloat(e.target.value) || 0)}
                          />
                        </div>
                        <div className="space-y-1 w-32">
                          <Label className="text-xs">Allowed Marks</Label>
                          <Input
                            value={sub.allowed_marks}
                            onChange={(e) => updateSubCriteria(crit.id, sub.id, 'allowed_marks', e.target.value)}
                            placeholder="0,3,5"
                            className="text-sm"
                          />
                        </div>
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive mt-5"
                          onClick={() =>
                            setCriteria((prev) =>
                              prev.map((c) =>
                                c.id === crit.id
                                  ? { ...c, sub_criteria: c.sub_criteria.filter((s) => s.id !== sub.id) }
                                  : c
                              )
                            )
                          }
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                      <Input
                        value={sub.description}
                        onChange={(e) => updateSubCriteria(crit.id, sub.id, 'description', e.target.value)}
                        placeholder="Description of this component (optional)"
                        className="text-xs"
                      />
                      {sub.allowed_marks && (
                        <p className="text-xs text-muted-foreground">
                          Reviewers pick from: {sub.allowed_marks.split(',').map(s => s.trim()).join(' · ')}
                        </p>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={() => addSubCriteria(crit.id)}>
                    <Plus size={14} />Add Sub-criterion
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}

        <Button variant="outline" className="w-full gap-2 border-dashed" onClick={addCriteria}>
          <Plus size={16} />
          Add {activeTab === 'guide' ? 'Guide' : 'Panel'} Criterion
        </Button>
      </div>
    </div>
  )
}
