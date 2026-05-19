import { consola } from 'consola'
import { and, eq, sql } from 'drizzle-orm'

import { roles, userRoles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const roleId = getRouterParam(event, 'id')
    if (!roleId) {
      throw createError({ statusCode: 400, statusMessage: 'Role id is required' })
    }

    const db = useDrizzle()

    const [existing] = await db
      .select({
        id: roles.id,
        name: roles.name,
        isSystem: roles.isSystem,
        memberCount: sql<number>`(SELECT COUNT(*)::int FROM ${userRoles} WHERE ${userRoles.roleId} = ${roles.id})`,
      })
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.organizationId, admin.organizationId)))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Role not found' })
    }

    if (existing.isSystem) {
      throw createError({
        statusCode: 403,
        statusMessage: 'System roles cannot be deleted. Edit their permissions instead.',
      })
    }

    if (existing.memberCount > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `Cannot delete: ${existing.memberCount} user(s) still hold this role.`,
      })
    }

    await db.delete(roles).where(eq(roles.id, roleId))

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'role',
      action: 'delete',
      resourceId: roleId,
      meta: { name: existing.name },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting role', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
