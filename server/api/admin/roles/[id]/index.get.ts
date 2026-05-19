import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { rolePermissions, roles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const roleId = getRouterParam(event, 'id')
    if (!roleId) {
      throw createError({ statusCode: 400, statusMessage: 'Role id is required' })
    }

    const db = useDrizzle()

    const [role] = await db
      .select()
      .from(roles)
      .where(and(eq(roles.id, roleId), eq(roles.organizationId, admin.organizationId)))
      .limit(1)

    if (!role) {
      throw createError({ statusCode: 404, statusMessage: 'Role not found' })
    }

    const perms = await db
      .select({ module: rolePermissions.module, action: rolePermissions.action })
      .from(rolePermissions)
      .where(eq(rolePermissions.roleId, role.id))

    return { role, permissions: perms }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching role', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
