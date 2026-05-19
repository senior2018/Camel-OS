import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { findRolesInOrg, setUserRoles } from '@@/server/utils/role'
import { logAuditEvent } from '@@/server/utils/audit'
import { setUserRolesSchema } from '@@/shared/schemas/role'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const targetId = getRouterParam(event, 'id')
    if (!targetId) {
      throw createError({ statusCode: 400, statusMessage: 'User id is required' })
    }

    const parsed = setUserRolesSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request payload' })
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

    // Reject if any roleId belongs to a different org (defence in depth — the IDs
    // come from the client, who shouldn't be trusted to scope them correctly).
    if (parsed.data.roleIds.length > 0) {
      const found = await findRolesInOrg(admin.organizationId, parsed.data.roleIds)
      if (found.length !== parsed.data.roleIds.length) {
        throw createError({
          statusCode: 400,
          statusMessage: 'One or more roles do not belong to this organization',
        })
      }
    }

    await setUserRoles(targetId, parsed.data.roleIds, admin.userId)

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user',
      action: 'roles_updated',
      resourceId: targetId,
      meta: { roleCount: parsed.data.roleIds.length },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error setting user roles', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
