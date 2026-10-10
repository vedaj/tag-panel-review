import { createServerSupabaseClient } from '@/lib/supabase-server'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupId, reviewId } = await req.json()
  if (!groupId || !reviewId) return NextResponse.json({ error: 'Missing groupId or reviewId' }, { status: 400 })

  // Verify caller is guide1 or guide2 on this group
  const { data: group } = await supabase
    .from('groups')
    .select('guide1_id, guide2_id')
    .eq('id', groupId)
    .single()

  if (!group) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const isGuide = group.guide1_id === user.id || group.guide2_id === user.id
  if (!isGuide) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase
    .from('group_review_status')
    .upsert({
      group_id: groupId,
      review_id: reviewId,
      guide_approval_status: 'approved',
      guide_approved_at: new Date().toISOString(),
      guide_approved_by: user.id,
    }, { onConflict: 'group_id,review_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
