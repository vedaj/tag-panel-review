import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { clearType } = await req.json() as { clearType: boolean }
  const admin = createAdminSupabaseClient()

  const DUMMY = '00000000-0000-0000-0000-000000000000'
  await admin.from('grades').delete().neq('id', DUMMY)
  await admin.from('feedback').delete().neq('id', DUMMY)
  if (clearType) {
    await admin.from('groups').update({ project_type: null }).neq('id', DUMMY)
  }

  return NextResponse.json({ success: true })
}
