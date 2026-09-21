import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, tag_id')
    .eq('id', user.id)
    .single()

  if (!profile || !['admin', 'institution_admin'].includes(profile.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { clearType } = await req.json() as { clearType: boolean }
  const admin = createAdminSupabaseClient()

  const isInstitutionAdmin = profile.role === 'institution_admin'
  const tagId: string | null = isInstitutionAdmin ? null : (profile.tag_id ?? null)

  if (tagId) {
    // Scoped reset: only touch this TAG's data
    const { data: groups } = await admin
      .from('groups')
      .select('id')
      .eq('tag_id', tagId)

    const groupIds = (groups ?? []).map((g: { id: string }) => g.id)

    if (groupIds.length > 0) {
      const { data: students } = await admin
        .from('students')
        .select('id')
        .in('group_id', groupIds)

      const studentIds = (students ?? []).map((s: { id: string }) => s.id)

      if (studentIds.length > 0) {
        await admin.from('grades').delete().in('student_id', studentIds)
      }

      await admin.from('feedback').delete().in('group_id', groupIds)

      if (clearType) {
        await admin.from('groups').update({ project_type: null }).in('id', groupIds)
      }
    }
  } else {
    // Institution-wide reset
    const DUMMY = '00000000-0000-0000-0000-000000000000'
    await admin.from('grades').delete().neq('id', DUMMY)
    await admin.from('feedback').delete().neq('id', DUMMY)
    if (clearType) {
      await admin.from('groups').update({ project_type: null }).neq('id', DUMMY)
    }
  }

  return NextResponse.json({ success: true })
}
