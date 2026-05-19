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

    const db = useDrizzle()
    const now = new Date()

    const [updated] = await db
      .update(users)
      .set({ deactivatedAt: null, status: 'active', updatedAt: now })
      .where(and(eq(users.id, targetId), eq(users.organizationId, admin.organizationId)))
      .returning({ id: users.id, email: users.email })

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user',
      action: 'reactivate',
      resourceId: targetId,
      meta: { targetEmail: updated.email, by: admin.email },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error reactivating user', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
