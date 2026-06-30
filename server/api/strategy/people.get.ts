import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** Lightweight org-people list for strategy owner / assignee pickers. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'read')
    const rows = await useDrizzle()
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(eq(users.organizationId, ctx.organizationId))
      .orderBy(asc(users.firstName))
    return {
      items: rows.map((u) => ({
        id: u.id,
        name: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
      })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing people', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
