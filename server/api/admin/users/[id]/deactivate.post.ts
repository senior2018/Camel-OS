import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const targetId = getRouterParam(event, 'id')
    if (!targetId) {
      throw createError({ statusCode: 400, statusMessage: 'User id is required' })
    }

    if (targetId === admin.userId) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot deactivate yourself' })
    }

    const db = useDrizzle()
    const now = new Date()

    // S5b — block deactivation of the super admin. Only a transfer (which
    // demotes the previous super admin) can remove super-admin status.
    const [target] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.organizationId, admin.organizationId)))
      .limit(1)
    if (target?.isSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'The super admin cannot be deactivated. Transfer the role first.',
      })
    }

    const [updated] = await db
      .update(users)
      .set({ deactivatedAt: now, status: 'suspended', updatedAt: now })
      .where(and(eq(users.id, targetId), eq(users.organizationId, admin.organizationId)))
      .returning({ id: users.id, email: users.email })

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user',
      action: 'deactivate',
      resourceId: targetId,
      meta: { targetEmail: updated.email, by: admin.email },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deactivating user', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
