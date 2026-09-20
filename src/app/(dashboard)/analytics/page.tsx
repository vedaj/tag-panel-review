import { createServerSupabaseClient } from '@/lib/supabase-server'
import { effectiveTagFilter } from '@/lib/admin-scope'
import { redirect } from 'next/navigation'
import AnalyticsClient from '@/components/analytics/AnalyticsClient'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*, tag:tags(*)').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'institution_admin'
  const tagId = await effectiveTagFilter(profile)

  let groupsQuery = supabase.from('groups').select('*').order('name')
  if (tagId) groupsQuery = groupsQuery.eq('tag_id', tagId)

  let criteriaQuery = supabase.from('criteria').select('*, sub_criteria(*)').order('order_index')
  if (tagId) criteriaQuery = criteriaQuery.eq('tag_id', tagId)

  let profilesQuery = supabase.from('profiles').select('*').order('name')
  if (tagId) profilesQuery = profilesQuery.eq('tag_id', tagId)

  const [
    { data: groups },
    { data: students },
    { data: criteria },
    { data: myGrades },
    { data: allGrades },
    { data: profiles },
  ] = await Promise.all([
    groupsQuery,
    supabase.from('students').select('*'),
    criteriaQuery,
    supabase.from('grades').select('*').eq('faculty_id', user.id).gt('marks', 0),
    isAdmin
      ? supabase.from('grades').select('*').gt('marks', 0).limit(200000)
      : Promise.resolve({ data: [] }),
    isAdmin
      ? profilesQuery
      : Promise.resolve({ data: [] }),
  ])

  return (
    <AnalyticsClient
      isAdmin={isAdmin}
      facultyId={user.id}
      facultyName={profile?.name ?? ''}
      groups={groups ?? []}
      students={students ?? []}
      criteria={criteria ?? []}
      myGrades={myGrades ?? []}
      allGrades={(allGrades ?? []) as NonNullable<typeof allGrades>}
      profiles={(profiles ?? []) as NonNullable<typeof profiles>}
    />
  )
}
