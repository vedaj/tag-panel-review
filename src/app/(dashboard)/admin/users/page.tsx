export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { effectiveTagFilter } from '@/lib/admin-scope'
import { UsersClient } from '@/components/admin/UsersClient'
import type { Role } from '@/types/database'

export type UserRow = {
  id: string
  name: string
  email: string
  role: Role
  tag_id: string | null
  tag_short_name: string | null
  created_at: string
  last_sign_in_at: string | null
}

export type TagOption = { id: string; short_name: string; name: string }

async function createUser(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role, tag_id').eq('id', caller.id).single()
  if (!profile || !['admin', 'institution_admin'].includes(profile.role)) throw new Error('Forbidden')

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = (formData.get('role') as Role) ?? 'faculty'
  const tagId = (formData.get('tag_id') as string) || profile.tag_id

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error) throw error

  await admin.from('profiles').upsert({ id: data.user.id, name, email, role, tag_id: tagId })
}

async function updateRole(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (!profile || !['admin', 'institution_admin'].includes(profile.role)) throw new Error('Forbidden')

  const userId = formData.get('userId') as string
  const role = formData.get('role') as Role

  const admin = createAdminSupabaseClient()
  await admin.from('profiles').update({ role }).eq('id', userId)
}

async function moveToTag(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (profile?.role !== 'institution_admin') throw new Error('Forbidden — institution admin only')

  const userId = formData.get('userId') as string
  const tagId = formData.get('tag_id') as string

  const admin = createAdminSupabaseClient()
  await admin.from('profiles').update({ tag_id: tagId }).eq('id', userId)
}

async function setPassword(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (!profile || !['admin', 'institution_admin'].includes(profile.role)) throw new Error('Forbidden')

  const userId = formData.get('userId') as string
  const password = formData.get('password') as string

  const admin = createAdminSupabaseClient()
  const { error } = await admin.auth.admin.updateUserById(userId, { password })
  if (error) throw error
}

async function deleteUser(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (!profile || !['admin', 'institution_admin'].includes(profile.role)) throw new Error('Forbidden')

  const userId = formData.get('userId') as string
  if (userId === caller.id) throw new Error('Cannot delete yourself')

  const admin = createAdminSupabaseClient()
  await admin.auth.admin.deleteUser(userId)
  await admin.from('profiles').delete().eq('id', userId)
}

export default async function UsersPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: callerProfile } = await supabase.from('profiles').select('role, tag_id').eq('id', user.id).single()
  if (!callerProfile || !['admin', 'institution_admin'].includes(callerProfile.role)) redirect('/dashboard')

  const isInstitutionAdmin = callerProfile.role === 'institution_admin'
  const tagFilter = await effectiveTagFilter(callerProfile)

  const admin = createAdminSupabaseClient()
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })

  let profilesQuery = admin.from('profiles').select('*, tag:tags(short_name, name)')
  if (tagFilter) profilesQuery = profilesQuery.eq('tag_id', tagFilter)
  const { data: profiles } = await profilesQuery

  const { data: allTags } = await admin.from('tags').select('id, short_name, name').order('short_name')

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const authIds = new Set((authData?.users ?? []).map((u) => u.id))

  const users: UserRow[] = (profiles ?? [])
    .filter((p) => authIds.has(p.id))
    .map((p) => {
      const authUser = (authData?.users ?? []).find((u) => u.id === p.id)
      return {
        id: p.id,
        name: p.name ?? '',
        email: p.email ?? '',
        role: (p.role ?? 'faculty') as Role,
        tag_id: p.tag_id ?? null,
        tag_short_name: (p.tag as { short_name?: string } | null)?.short_name ?? null,
        created_at: authUser?.created_at ?? p.created_at,
        last_sign_in_at: authUser?.last_sign_in_at ?? null,
      }
    })
    .sort((a, b) => a.name.localeCompare(b.name))

  // Include auth users not yet in profiles (in case trigger didn't fire)
  for (const au of authData?.users ?? []) {
    if (!profileMap.has(au.id) && (!tagFilter)) {
      users.push({
        id: au.id,
        name: au.user_metadata?.name ?? '',
        email: au.email ?? '',
        role: 'faculty',
        tag_id: null,
        tag_short_name: null,
        created_at: au.created_at,
        last_sign_in_at: au.last_sign_in_at ?? null,
      })
    }
  }

  return (
    <UsersClient
      users={users}
      currentUserId={user.id}
      tags={(allTags ?? []) as TagOption[]}
      isInstitutionAdmin={isInstitutionAdmin}
      callerTagId={callerProfile.tag_id ?? null}
      createUser={createUser}
      updateRole={updateRole}
      moveToTag={moveToTag}
      setPassword={setPassword}
      deleteUser={deleteUser}
    />
  )
}
