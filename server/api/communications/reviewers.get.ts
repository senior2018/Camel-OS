import { consola } from 'consola'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { rolePermissions, userRoles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * Eligible content reviewers — active org members whose roles grant
 * `communications:approve` (or admin). Powers the "Send for review" picker so
 * only people who can actually act on the workflow can be assigned.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')

    const rows = await useDrizzle()
      .selectDistinct({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .innerJoin(userRoles, eq(userRoles.userId, users.id))
      .innerJoin(rolePermissions, eq(rolePermissions.roleId, userRoles.roleId))
      .where(
        and(
          eq(users.organizationId, ctx.organizationId),
          isNull(users.deactivatedAt),
          eq(rolePermissions.module, 'communications'),
          inArray(rolePermissions.action, ['approve', 'admin'])
        )
      )
      .orderBy(asc(users.firstName), asc(users.lastName))

    return { reviewers: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing content reviewers', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
