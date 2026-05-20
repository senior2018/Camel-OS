import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clientInteractions } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    const interactionId = getRouterParam(event, 'interactionId')
    if (!clientId || !interactionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Client and interaction ids are required',
      })
    }

    const [deleted] = await useDrizzle()
      .delete(clientInteractions)
      .where(
        and(
          eq(clientInteractions.id, interactionId),
          eq(clientInteractions.clientId, clientId),
          eq(clientInteractions.organizationId, ctx.organizationId)
        )
      )
      .returning({ id: clientInteractions.id })

    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Interaction not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'interaction_removed',
      resourceId: clientId,
      meta: { interactionId: deleted.id },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting interaction', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
