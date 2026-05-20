import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clientReminders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateReminderSchema } from '@@/shared/schemas/client'

/**
 * Mark a reminder complete, reschedule it, or change the assignee. `completed`
 * flips `completedAt` on/off — passing `true` stamps now, `false` clears it.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    const reminderId = getRouterParam(event, 'reminderId')
    if (!clientId || !reminderId) {
      throw createError({ statusCode: 400, statusMessage: 'Client and reminder ids are required' })
    }

    const parsed = updateReminderSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid reminder payload',
      })
    }

    const data = parsed.data
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.contactId !== undefined) updates.contactId = data.contactId ?? null
    if (data.assignedUserId !== undefined) updates.assignedUserId = data.assignedUserId
    if (data.dueAt !== undefined) updates.dueAt = new Date(data.dueAt)
    if (data.message !== undefined) updates.message = data.message
    if (data.completed !== undefined) updates.completedAt = data.completed ? new Date() : null

    const [updated] = await useDrizzle()
      .update(clientReminders)
      .set(updates)
      .where(
        and(
          eq(clientReminders.id, reminderId),
          eq(clientReminders.clientId, clientId),
          eq(clientReminders.organizationId, ctx.organizationId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Reminder not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: data.completed === true ? 'reminder_completed' : 'reminder_updated',
      resourceId: clientId,
      meta: { reminderId: updated.id },
    })

    return { success: true, reminder: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating reminder', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
