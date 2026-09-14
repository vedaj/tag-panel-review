export const dynamic = 'force-dynamic'

import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { UsersClient } from '@/components/admin/UsersClient'
import type { Role } from '@/types/database'

export type UserRow = {
  id: string
  name: string
  email: string
  role: Role
  created_at: string
  last_sign_in_at: string | null
}

async function createUser(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const name = formData.get('name') as string
  const email = formData.get('email') as string
  const password = formData.get('password') as string
  const role = (formData.get('role') as Role) ?? 'faculty'

  const admin = createAdminSupabaseClient()
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error) throw error

  await admin.from('profiles').upsert({ id: data.user.id, name, email, role })
}

async function updateRole(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

  const userId = formData.get('userId') as string
  const role = formData.get('role') as Role

  const admin = createAdminSupabaseClient()
  await admin.from('profiles').update({ role }).eq('id', userId)
}

async function setPassword(formData: FormData) {
  'use server'
  const supabase = await createServerSupabaseClient()
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) throw new Error('Not authenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', caller.id).single()
  if (profile?.role !== 'admin') throw new Error('Forbidden')

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
  if (profile?.role !== 'admin') throw new Error('Forbidden')

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

  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const admin = createAdminSupabaseClient()
  const { data: authData } = await admin.auth.admin.listUsers({ perPage: 1000 })
  const { data: profiles } = await admin.from('profiles').select('*')

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  const users: UserRow[] = (authData?.users ?? []).map((u) => {
    const p = profileMap.get(u.id)
    return {
      id: u.id,
      name: p?.name ?? u.user_metadata?.name ?? '',
      email: u.email ?? '',
      role: (p?.role ?? 'faculty') as Role,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at ?? null,
    }
  }).sort((a, b) => a.name.localeCompare(b.name))

  return (
    <UsersClient
      users={users}
      currentUserId={user.id}
      createUser={createUser}
      updateRole={updateRole}
      setPassword={setPassword}
      deleteUser={deleteUser}
    />
  )
}
