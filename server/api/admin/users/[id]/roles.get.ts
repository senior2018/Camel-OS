import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { roles, userRoles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const targetId = getRouterParam(event, 'id')
    if (!targetId) {
      throw createError({ statusCode: 400, statusMessage: 'User id is required' })
    }

    const db = useDrizzle()

    const [target] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.organizationId, admin.organizationId)))
      .limit(1)

    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    const assignedRoles = await db
      .select({
        id: roles.id,
        name: roles.name,
        description: roles.description,
        mfaRequired: roles.mfaRequired,
        isSystem: roles.isSystem,
      })
      .from(userRoles)
      .innerJoin(roles, eq(roles.id, userRoles.roleId))
      .where(eq(userRoles.userId, targetId))

    return { roles: assignedRoles }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching user roles', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
