import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clientReminders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    const reminderId = getRouterParam(event, 'reminderId')
    if (!clientId || !reminderId) {
      throw createError({ statusCode: 400, statusMessage: 'Client and reminder ids are required' })
    }

    const [deleted] = await useDrizzle()
      .delete(clientReminders)
      .where(
        and(
          eq(clientReminders.id, reminderId),
          eq(clientReminders.clientId, clientId),
          eq(clientReminders.organizationId, ctx.organizationId)
        )
      )
      .returning({ id: clientReminders.id })

    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Reminder not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'reminder_removed',
      resourceId: clientId,
      meta: { reminderId: deleted.id },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting reminder', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
