import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { expertProfiles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'

/** EX-04 — minimal expert list for the proposal "insert CV" picker. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['hr', 'read'],
      ['proposal', 'update'],
      ['proposal', 'create'],
    ])
    const rows = await useDrizzle()
      .select({
        userId: expertProfiles.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        headline: expertProfiles.headline,
      })
      .from(expertProfiles)
      .leftJoin(users, eq(users.id, expertProfiles.userId))
      .where(eq(expertProfiles.organizationId, ctx.organizationId))
      .orderBy(asc(users.firstName))
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing experts for picker', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
