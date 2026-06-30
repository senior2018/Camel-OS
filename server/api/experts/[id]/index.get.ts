import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { certifications, expertProfiles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** EX-01 / EX-02 — one expert's profile + virtual CV + certifications. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const userId = getRouterParam(event, 'id')
    if (!userId) throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
    const db = useDrizzle()

    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Expert not found' })

    const [profile] = await db
      .select()
      .from(expertProfiles)
      .where(eq(expertProfiles.userId, userId))
      .limit(1)

    const certs = await db
      .select()
      .from(certifications)
      .where(eq(certifications.userId, userId))
      .orderBy(desc(certifications.expiryDate))

    return { user, profile: profile ?? null, certifications: certs }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading expert', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
