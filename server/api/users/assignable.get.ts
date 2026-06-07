import { consola } from 'consola'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * Lightweight team roster used by the opportunity form's "Owner" picker.
 * Returns active (non-deactivated) members of the caller's organization so any
 * staff member can be assigned as the owner of a pipeline item.
 *
 * Read access is gated on `opportunity:read` — anyone who can see the pipeline
 * can see the names available for assignment.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')

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

    return { members: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing opportunity team', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
