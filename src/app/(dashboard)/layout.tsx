import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import { DashboardShell } from '@/components/DashboardShell'
import type { Tag } from '@/types/database'
import { getAdminScope } from '@/lib/admin-scope'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('*, tag:tags(*)')
    .eq('id', user.id)
    .single()

  const { data: tags } = await supabase
    .from('tags')
    .select('*')
    .order('name') as { data: Tag[] | null }

  const adminScope = profile?.role === 'institution_admin' ? await getAdminScope() : 'tag'

  return (
    <DashboardShell profile={profile} tags={tags ?? []} adminScope={adminScope}>
      {children}
    </DashboardShell>
  )
}
