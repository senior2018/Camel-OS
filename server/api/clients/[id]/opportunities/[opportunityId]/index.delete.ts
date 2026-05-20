import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunityClients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    const opportunityId = getRouterParam(event, 'opportunityId')
    if (!clientId || !opportunityId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Client and opportunity ids are required',
      })
    }

    const [removed] = await useDrizzle()
      .delete(opportunityClients)
      .where(
        and(
          eq(opportunityClients.clientId, clientId),
          eq(opportunityClients.opportunityId, opportunityId),
          eq(opportunityClients.organizationId, ctx.organizationId)
        )
      )
      .returning({ opportunityId: opportunityClients.opportunityId })

    if (!removed) {
      throw createError({ statusCode: 404, statusMessage: 'Link not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'opportunity_unlinked',
      resourceId: clientId,
      meta: { opportunityId: removed.opportunityId },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error unlinking opportunity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
