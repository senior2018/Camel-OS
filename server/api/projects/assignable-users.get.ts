import { consola } from 'consola'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** Active org members for the PM / team / activity-assignee pickers. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const rows = await useDrizzle()
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(and(eq(users.organizationId, ctx.organizationId), isNull(users.deactivatedAt)))
      .orderBy(asc(users.firstName), asc(users.lastName))
    return { users: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing assignable users', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
