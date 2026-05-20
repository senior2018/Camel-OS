import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clientReminders, clients, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createReminderSchema } from '@@/shared/schemas/client'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    if (!clientId) throw createError({ statusCode: 400, statusMessage: 'Client id is required' })

    const parsed = createReminderSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid reminder payload',
      })
    }

    const data = parsed.data
    const db = useDrizzle()

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)
    if (!client) throw createError({ statusCode: 404, statusMessage: 'Client not found' })

    // Ensure the assignee is in the same org — prevents cross-org leakage even if
    // a stale UUID is submitted from the browser.
    const [assignee] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, data.assignedUserId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!assignee) throw createError({ statusCode: 400, statusMessage: 'Invalid assignee' })

    const [created] = await db
      .insert(clientReminders)
      .values({
        clientId,
        organizationId: ctx.organizationId,
        contactId: data.contactId ?? null,
        assignedUserId: data.assignedUserId,
        dueAt: new Date(data.dueAt),
        message: data.message,
        createdByUserId: ctx.userId,
      })
      .returning()

    if (!created) throw new Error('Failed to create reminder')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'reminder_created',
      resourceId: clientId,
      meta: {
        reminderId: created.id,
        dueAt: created.dueAt instanceof Date ? created.dueAt.toISOString() : String(created.dueAt),
        assignedUserId: created.assignedUserId,
      },
    })

    return { success: true, reminder: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating reminder', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
