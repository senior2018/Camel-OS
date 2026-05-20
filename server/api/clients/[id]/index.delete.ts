import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Hard-delete a client. Foreign keys cascade so contacts, interactions, links,
 * and reminders go with it. The audit row preserves the name for forensics.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'delete')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Client id is required' })

    const [deleted] = await useDrizzle()
      .delete(clients)
      .where(and(eq(clients.id, id), eq(clients.organizationId, ctx.organizationId)))
      .returning({ id: clients.id, name: clients.name })

    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Client not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'delete',
      resourceId: deleted.id,
      meta: { name: deleted.name },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting client', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
