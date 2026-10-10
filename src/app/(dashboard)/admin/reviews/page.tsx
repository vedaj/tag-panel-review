'use client'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { Review, TagReview, Tag, ReviewUnlockRequest } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Plus, Loader2, RefreshCw, Lock, Unlock, CheckCircle2, XCircle, Clock } from 'lucide-react'

type TagReviewWithRelations = TagReview & { review: Review; tag: Tag }
type UnlockRequestWithRelations = ReviewUnlockRequest & { review: Review; tag: Tag; requester: { name: string; email: string } }

export default function ReviewsPage() {
  const supabase = createClient()
  const [reviews, setReviews] = useState<Review[]>([])
  const [tagReviews, setTagReviews] = useState<TagReviewWithRelations[]>([])
  const [tags, setTags] = useState<Tag[]>([])
  const [unlockRequests, setUnlockRequests] = useState<UnlockRequestWithRelations[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [newReviewName, setNewReviewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => { loadData() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadData() {
    setLoading(true)
    const [{ data: rv }, { data: tr }, { data: tg }, { data: ur }] = await Promise.all([
      supabase.from('reviews').select('*').order('order_index'),
      supabase.from('tag_reviews').select('*, review:review_id(*), tag:tag_id(*)').order('created_at'),
      supabase.from('tags').select('*').order('name'),
      supabase.from('review_unlock_requests')
        .select('*, review:review_id(*), tag:tag_id(*), requester:requested_by(name, email)')
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ])
    setReviews(rv ?? [])
    setTagReviews((tr ?? []) as TagReviewWithRelations[])
    setTags(tg ?? [])
    setUnlockRequests((ur ?? []) as UnlockRequestWithRelations[])
    setLoading(false)
  }

  async function createReview() {
    if (!newReviewName.trim()) return
    setCreating(true)
    const { data: rv } = await supabase
      .from('reviews')
      .insert({ name: newReviewName.trim(), order_index: reviews.length })
      .select()
      .single()
    if (rv) {
      // Seed tag_reviews for every TAG as 'upcoming'
      if (tags.length > 0) {
        await supabase.from('tag_reviews').insert(
          tags.map((t) => ({ tag_id: t.id, review_id: rv.id, status: 'upcoming' }))
        )
      }
      setNewReviewName('')
      setShowCreate(false)
      await loadData()
    }
    setCreating(false)
  }

  async function setTagReviewStatus(tagReviewId: string, status: 'active' | 'locked', userId?: string) {
    setSaving(tagReviewId)
    const updatePayload: Record<string, unknown> = { status }
    if (status === 'active') {
      updatePayload.activated_at = new Date().toISOString()
      updatePayload.activated_by = userId ?? null
      updatePayload.locked_at = null
      updatePayload.locked_by = null
    } else {
      updatePayload.locked_at = new Date().toISOString()
      updatePayload.locked_by = userId ?? null
    }
    await supabase.from('tag_reviews').update(updatePayload).eq('id', tagReviewId)
    await loadData()
    setSaving(null)
  }

  async function handleUnlockRequest(requestId: string, approved: boolean, tagReviewId: string) {
    setSaving(requestId)
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('review_unlock_requests').update({
      status: approved ? 'approved' : 'rejected',
      reviewed_by: user?.id,
      reviewed_at: new Date().toISOString(),
    }).eq('id', requestId)
    if (approved) await setTagReviewStatus(tagReviewId, 'active', user?.id ?? undefined)
    else {
      await loadData()
      setSaving(null)
    }
  }

  const statusBadge = (status: string) => {
    if (status === 'active') return <Badge style={{ background: '#dcfce7', color: '#16a34a', border: '1px solid #bbf7d0' }} className="gap-1"><CheckCircle2 size={11} />Active</Badge>
    if (status === 'locked') return <Badge style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fecaca' }} className="gap-1"><Lock size={11} />Locked</Badge>
    return <Badge variant="secondary" className="gap-1"><Clock size={11} />Upcoming</Badge>
  }

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 className="animate-spin text-muted-foreground" /></div>

  return (
    <div className="p-6 md:p-8 pt-20 md:pt-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="eyebrow mb-1">Institution Admin</p>
          <h1 style={{ margin: 0, fontFamily: 'var(--title-font)', fontSize: '1.8rem', letterSpacing: '-0.03em', color: 'var(--app-hero-text)' }}>Reviews</h1>
          <p style={{ color: 'var(--app-hero-subtext)', fontSize: '0.88rem', marginTop: 4 }}>
            Create reviews and manage their activation across TAGs.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={loadData} className="gap-2"><RefreshCw size={14} />Refresh</Button>
          <Button size="sm" onClick={() => setShowCreate((v) => !v)} className="gap-2"><Plus size={14} />New Review</Button>
        </div>
      </div>

      {/* Create new review */}
      {showCreate && (
        <Card className="mb-6">
          <CardContent className="pt-4">
            <div className="flex gap-3 items-end">
              <div className="flex-1">
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Review Name</label>
                <Input
                  value={newReviewName}
                  onChange={(e) => setNewReviewName(e.target.value)}
                  placeholder="e.g. Review 2"
                  onKeyDown={(e) => e.key === 'Enter' && createReview()}
                />
              </div>
              <Button onClick={createReview} disabled={creating || !newReviewName.trim()} className="gap-2">
                {creating ? <><Loader2 size={14} className="animate-spin" />Creating…</> : <><Plus size={14} />Create</>}
              </Button>
              <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              After creating, go to Rubrics to set guide and panel criteria for this review.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Unlock requests */}
      {unlockRequests.length > 0 && (
        <div className="mb-6">
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">Pending Unlock Requests</h2>
          <div className="space-y-3">
            {unlockRequests.map((req) => {
              const tr = tagReviews.find((t) => t.tag_id === req.tag_id && t.review_id === req.review_id)
              return (
                <Card key={req.id} style={{ borderColor: '#fbbf24', background: '#fffbeb' }}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <p className="text-sm font-medium">{req.tag?.name} — {req.review?.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          Requested by {req.requester?.name} ({req.requester?.email})
                          {req.reason && ` · "${req.reason}"`}
                        </p>
                      </div>
                      <div className="flex gap-2 flex-shrink-0">
                        <Button
                          size="sm"
                          disabled={saving === req.id}
                          onClick={() => tr && handleUnlockRequest(req.id, true, tr.id)}
                          style={{ background: '#16a34a', color: '#fff' }}
                          className="gap-1"
                        >
                          {saving === req.id ? <Loader2 size={13} className="animate-spin" /> : <><Unlock size={13} />Approve</>}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={saving === req.id}
                          onClick={() => handleUnlockRequest(req.id, false, '')}
                          className="gap-1 text-destructive border-destructive/30"
                        >
                          <XCircle size={13} />Reject
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      {/* Reviews list */}
      {reviews.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">No reviews yet. Create the first one above.</CardContent></Card>
      ) : (
        <div className="space-y-6">
          {reviews.map((review) => {
            const trs = tagReviews.filter((t) => t.review_id === review.id)
            return (
              <Card key={review.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">{review.name}</CardTitle>
                      <CardDescription className="mt-0.5">
                        {trs.filter((t) => t.status === 'active').length} active · {trs.filter((t) => t.status === 'locked').length} locked · {trs.filter((t) => t.status === 'upcoming').length} upcoming
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {trs.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No TAGs linked. All TAGs should be seeded automatically.</p>
                  ) : (
                    <div className="space-y-2">
                      {trs.map((tr) => (
                        <div key={tr.id} className="flex items-center justify-between gap-3 py-2 border-b last:border-0">
                          <div className="flex items-center gap-3">
                            {statusBadge(tr.status)}
                            <span className="text-sm font-medium">{tr.tag?.name}</span>
                            {tr.expires_at && (
                              <span className="text-xs text-muted-foreground">
                                expires {new Date(tr.expires_at).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          <div className="flex gap-2">
                            {tr.status !== 'active' && (
                              <Button
                                size="sm" variant="outline"
                                disabled={saving === tr.id}
                                onClick={async () => {
                                  const { data: { user } } = await supabase.auth.getUser()
                                  setTagReviewStatus(tr.id, 'active', user?.id ?? undefined)
                                }}
                                className="gap-1 text-green-700 border-green-300 hover:bg-green-50"
                              >
                                {saving === tr.id ? <Loader2 size={13} className="animate-spin" /> : <><Unlock size={13} />Activate</>}
                              </Button>
                            )}
                            {tr.status === 'active' && (
                              <Button
                                size="sm" variant="outline"
                                disabled={saving === tr.id}
                                onClick={async () => {
                                  const { data: { user } } = await supabase.auth.getUser()
                                  setTagReviewStatus(tr.id, 'locked', user?.id ?? undefined)
                                }}
                                className="gap-1 text-destructive border-destructive/30 hover:bg-destructive/10"
                              >
                                {saving === tr.id ? <Loader2 size={13} className="animate-spin" /> : <><Lock size={13} />Lock</>}
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
