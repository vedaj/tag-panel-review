export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'
import { GuideSheetClient } from '@/components/grading/GuideSheetClient'

interface Props {
  params: Promise<{ groupId: string }>
}

export default async function GuidePage({ params }: Props) {
  const { groupId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Must be guide1 or guide2 on this group
  const { data: group } = await supabase
    .from('groups')
    .select('*, students(id, name, roll_number), guide1_profile:guide1_id(id, name, email), guide2_profile:guide2_id(id, name, email)')
    .eq('id', groupId)
    .single()

  if (!group) notFound()

  const isGuide = group.guide1_id === user.id || group.guide2_id === user.id
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin'

  if (!isGuide && !isAdmin) notFound()

  group.students = (group.students ?? []).sort(
    (a: { roll_number: string }, b: { roll_number: string }) => a.roll_number.localeCompare(b.roll_number)
  )

  // Only guide-type criteria
  const { data: criteria } = await supabase
    .from('criteria')
    .select('*, sub_criteria(id, title, description, max_marks, order_index, allowed_marks)')
    .eq('review_type', 'guide')
    .order('order_index')

  const sortedCriteria = (criteria ?? []).map((c) => ({
    ...c,
    project_type: c.project_type ?? 'all',
    allowed_marks: c.allowed_marks ?? '',
    sub_criteria: (c.sub_criteria ?? [])
      .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
      .map((s: { allowed_marks?: string | null; [k: string]: unknown }) => ({ ...s, allowed_marks: s.allowed_marks ?? '' })),
  }))

  const studentIds = group.students.map((s: { id: string }) => s.id)
  const { data: existingGrades } = studentIds.length > 0
    ? await supabase.from('grades').select('*').eq('faculty_id', user.id).in('student_id', studentIds)
    : { data: [] }

  const { data: existingFeedback } = await supabase
    .from('feedback').select('*').eq('faculty_id', user.id).eq('group_id', groupId)

  return (
    <GuideSheetClient
      group={group}
      criteria={sortedCriteria}
      existingGrades={existingGrades ?? []}
      existingFeedback={existingFeedback ?? []}
      facultyId={user.id}
    />
  )
}
