import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { groupId, projectTitle } = await req.json() as { groupId: string; projectTitle: string }
  if (!groupId) return NextResponse.json({ error: 'Missing groupId' }, { status: 400 })

  const admin = createAdminSupabaseClient()
  const { error } = await admin.from('groups').update({ project_title: projectTitle }).eq('id', groupId)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ success: true })
}
