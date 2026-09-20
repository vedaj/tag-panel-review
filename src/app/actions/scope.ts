'use server'
import { cookies } from 'next/headers'

export type AdminScope = 'institution' | 'tag'

export async function setAdminScope(scope: AdminScope) {
  const jar = await cookies()
  jar.set('tag:scope', scope, { path: '/', maxAge: 60 * 60 * 24 * 365, sameSite: 'lax' })
}
