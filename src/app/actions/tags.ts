'use server'

import { createServerSupabaseClient } from '@/lib/supabase-server'
import { createAdminSupabaseClient } from '@/lib/supabase-admin'

async function assertInstitutionAdmin() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Unauthenticated')
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'institution_admin') throw new Error('Unauthorized')
  return createAdminSupabaseClient()
}

export async function createTagAction(name: string, shortName: string) {
  const admin = await assertInstitutionAdmin()
  const { data: tag, error } = await admin.from('tags')
    .insert({ name: name.trim(), short_name: shortName.trim().toUpperCase() })
    .select().single()
  if (error || !tag) return { error: error?.message ?? 'Failed to create TAG' }
  // Seed tag_reviews for every existing review as 'upcoming'
  const { data: reviews } = await admin.from('reviews').select('id')
  if (reviews && reviews.length > 0) {
    await admin.from('tag_reviews').insert(
      reviews.map(r => ({ tag_id: tag.id, review_id: r.id, status: 'upcoming' }))
    )
  }
  return { success: true }
}

export async function updateTagAction(id: string, name: string, shortName: string) {
  const admin = await assertInstitutionAdmin()
  const { error } = await admin.from('tags')
    .update({ name: name.trim(), short_name: shortName.trim().toUpperCase() })
    .eq('id', id)
  return error ? { error: error.message } : { success: true }
}

export async function deleteTagAction(id: string) {
  const admin = await assertInstitutionAdmin()
  // Demote any TAG admins and unassign all members first
  await admin.from('profiles').update({ role: 'faculty', tag_id: null })
    .eq('tag_id', id).eq('role', 'admin')
  await admin.from('profiles').update({ tag_id: null }).eq('tag_id', id)
  const { error } = await admin.from('tags').delete().eq('id', id)
  return error ? { error: error.message } : { success: true }
}

export async function assignMemberToTagAction(profileId: string, tagId: string) {
  const admin = await assertInstitutionAdmin()
  // Fetch current role — if they were a TAG admin, moving revokes that
  const { data: profile } = await admin.from('profiles')
    .select('role, tag_id').eq('id', profileId).single()
  const updates: Record<string, unknown> = { tag_id: tagId }
  if (profile?.role === 'admin') updates.role = 'faculty'
  const { error } = await admin.from('profiles').update(updates).eq('id', profileId)
  return error ? { error: error.message } : { success: true }
}

export async function removeMemberFromTagAction(profileId: string) {
  const admin = await assertInstitutionAdmin()
  const { data: profile } = await admin.from('profiles')
    .select('role').eq('id', profileId).single()
  const updates: Record<string, unknown> = { tag_id: null }
  if (profile?.role === 'admin') updates.role = 'faculty'
  const { error } = await admin.from('profiles').update(updates).eq('id', profileId)
  return error ? { error: error.message } : { success: true }
}

export async function elevateToAdminAction(profileId: string) {
  const admin = await assertInstitutionAdmin()
  const { error } = await admin.from('profiles').update({ role: 'admin' }).eq('id', profileId)
  return error ? { error: error.message } : { success: true }
}

export async function demoteToFacultyAction(profileId: string) {
  const admin = await assertInstitutionAdmin()
  const { error } = await admin.from('profiles').update({ role: 'faculty' }).eq('id', profileId)
  return error ? { error: error.message } : { success: true }
}
