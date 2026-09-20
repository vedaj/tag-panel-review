import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'
import { effectiveTagFilter, getAdminScope } from '@/lib/admin-scope'
import { redirect } from 'next/navigation'
import AnalyticsClient from '@/components/analytics/AnalyticsClient'
import InstitutionAnalyticsClient, { type TagAnalyticsData } from '@/components/analytics/InstitutionAnalyticsClient'

export const dynamic = 'force-dynamic'

export default async function AnalyticsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase.from('profiles').select('*, tag:tags(*)').eq('id', user.id).single()
  const isAdmin = profile?.role === 'admin' || profile?.role === 'institution_admin'
  const tagId = await effectiveTagFilter(profile)

  // Institution admin in institution scope → cross-TAG analytics
  if (profile?.role === 'institution_admin' && !tagId) {
    const adminScope = await getAdminScope()
    if (adminScope === 'institution') {
      const admin = createAdminSupabaseClient()
      const [{ data: tags }, { data: profiles }, { data: groups }, { data: grades }] = await Promise.all([
        admin.from('tags').select('*').order('short_name'),
        admin.from('profiles').select('id, role, tag_id'),
        admin.from('groups').select('id, tag_id, students(id)'),
        admin.from('grades').select('student_id, faculty_id').gt('marks', 0),
      ])

      const gradedStudentSet = new Set((grades ?? []).map((g: { student_id: string }) => g.student_id))
      const gradingFacultyByTag: Record<string, Set<string>> = {}

      // Build a map: student_id → tag_id via groups
      const studentTagMap = new Map<string, string>()
      for (const group of groups ?? []) {
        if (!group.tag_id) continue
        for (const student of (group.students ?? []) as { id: string }[]) {
          studentTagMap.set(student.id, group.tag_id)
        }
      }

      // Build grading faculty per TAG: faculty_id → tag_id via profiles
      const facultyTagMap = new Map<string, string>()
      for (const p of profiles ?? []) {
        if (p.tag_id) facultyTagMap.set(p.id, p.tag_id)
      }

      for (const tag of tags ?? []) {
        gradingFacultyByTag[tag.id] = new Set()
      }
      for (const grade of grades ?? []) {
        const tagId2 = facultyTagMap.get(grade.faculty_id)
        if (tagId2 && gradingFacultyByTag[tagId2]) {
          gradingFacultyByTag[tagId2].add(grade.faculty_id)
        }
      }

      const tagData: TagAnalyticsData[] = (tags ?? []).map((tag) => {
        const tagProfiles = (profiles ?? []).filter((p: { tag_id: string | null; role: string }) => p.tag_id === tag.id)
        const tagGroups = (groups ?? []).filter((g: { tag_id: string | null }) => g.tag_id === tag.id)
        const allStudents = tagGroups.flatMap((g) => (g.students ?? []) as { id: string }[])
        const studentCount = allStudents.length
        const gradedCount = allStudents.filter((s) => gradedStudentSet.has(s.id)).length
        const facultyCount = tagProfiles.filter((p) => p.role === 'faculty' || p.role === 'admin').length
        const facultyGrading = gradingFacultyByTag[tag.id]?.size ?? 0
        const pct = studentCount > 0 ? Math.round((gradedCount / studentCount) * 100) : 0
        return {
          id: tag.id,
          short_name: tag.short_name,
          name: tag.name,
          pct,
          students: studentCount,
          graded: gradedCount,
          groups: tagGroups.length,
          faculty: facultyCount,
          faculty_grading: facultyGrading,
          faculty_pct: facultyCount > 0 ? Math.round((facultyGrading / facultyCount) * 100) : 0,
        }
      })

      return <InstitutionAnalyticsClient tags={tagData} />
    }
  }

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
