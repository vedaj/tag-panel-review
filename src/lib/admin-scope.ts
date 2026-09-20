import { cookies } from 'next/headers'
import type { Profile } from '@/types/database'

export type AdminScope = 'institution' | 'tag'

export async function getAdminScope(): Promise<AdminScope> {
  const jar = await cookies()
  const v = jar.get('tag:scope')?.value
  return v === 'tag' ? 'tag' : 'institution'
}

/**
 * Returns the tag_id to filter queries by, given the current user's profile
 * and their active scope. Returns null when no filter should be applied.
 */
export async function effectiveTagFilter(profile: Pick<Profile, 'role' | 'tag_id'> | null): Promise<string | null> {
  if (!profile) return null
  if (profile.role === 'institution_admin') {
    const scope = await getAdminScope()
    return scope === 'tag' ? profile.tag_id : null
  }
  return profile.tag_id
}
