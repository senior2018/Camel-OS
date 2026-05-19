import { consola } from 'consola'
import { asc, eq, sql } from 'drizzle-orm'

import { rolePermissions, roles, userRoles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const db = useDrizzle()

    const rows = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        mfaRequired: roles.mfaRequired,
        isSystem: roles.isSystem,
        createdAt: roles.createdAt,
        // Counts let the list render summary chips without a second round-trip.
        permissionCount: sql<number>`(SELECT COUNT(*)::int FROM ${rolePermissions} WHERE ${rolePermissions.roleId} = ${roles.id})`,
        memberCount: sql<number>`(SELECT COUNT(*)::int FROM ${userRoles} WHERE ${userRoles.roleId} = ${roles.id})`,
      })
      .from(roles)
      .where(eq(roles.organizationId, admin.organizationId))
      .orderBy(asc(roles.name))

    return { roles: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing roles', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
