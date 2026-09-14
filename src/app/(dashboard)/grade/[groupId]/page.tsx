export const dynamic = 'force-dynamic'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { notFound, redirect } from 'next/navigation'
import { GradingSheetClient } from '@/components/grading/GradingSheetClient'

interface Props {
  params: Promise<{ groupId: string }>
}

export default async function GradePage({ params }: Props) {
  const { groupId } = await params
  const supabase = await createServerSupabaseClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  // Fetch group with students
  const { data: group } = await supabase
    .from('groups')
    .select('*, students(id, name, roll_number), project_type')
    .eq('id', groupId)
    .single()

  if (!group) notFound()

  // Sort students by roll number
  group.students = (group.students ?? []).sort((a: { roll_number: string }, b: { roll_number: string }) =>
    a.roll_number.localeCompare(b.roll_number)
  )

  // Fetch criteria with sub-criteria
  const { data: criteria } = await supabase
    .from('criteria')
    .select('*, sub_criteria(id, title, description, max_marks, order_index, allowed_marks), allowed_marks')
    .order('order_index')

  // Sort sub_criteria within each criterion
  const sortedCriteria = (criteria ?? []).map((c) => ({
    ...c,
    project_type: c.project_type ?? 'all',
    allowed_marks: c.allowed_marks ?? '',
    sub_criteria: (c.sub_criteria ?? [])
      .sort((a: { order_index: number }, b: { order_index: number }) => a.order_index - b.order_index)
      .map((s: { allowed_marks?: string | null, [k: string]: unknown }) => ({ ...s, allowed_marks: s.allowed_marks ?? '' })),
  }))

  // Fetch this faculty's existing grades for this group
  const studentIds = group.students.map((s: { id: string }) => s.id)
  const { data: existingGrades } = studentIds.length > 0
    ? await supabase
        .from('grades')
        .select('*')
        .eq('faculty_id', user.id)
        .in('student_id', studentIds)
    : { data: [] }

  // Fetch feedback
  const { data: existingFeedback } = await supabase
    .from('feedback')
    .select('*')
    .eq('faculty_id', user.id)
    .eq('group_id', groupId)

  return (
    <GradingSheetClient
      group={group}
      criteria={sortedCriteria}
      existingGrades={existingGrades ?? []}
      existingFeedback={existingFeedback ?? []}
      facultyId={user.id}
    />
  )
}
