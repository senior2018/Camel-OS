import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { partnershipAgreements } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/** CR-11 — Delete a partnership agreement. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'delete')
    const partnerId = getRouterParam(event, 'id')
    const agreementId = getRouterParam(event, 'agreementId')
    if (!partnerId || !agreementId) {
      throw createError({ statusCode: 400, statusMessage: 'Partner + agreement ids are required' })
    }

    const db = useDrizzle()

    const result = await db
      .delete(partnershipAgreements)
      .where(
        and(
          eq(partnershipAgreements.id, agreementId),
          eq(partnershipAgreements.partnerId, partnerId),
          eq(partnershipAgreements.organizationId, ctx.organizationId)
        )
      )
      .returning({ id: partnershipAgreements.id })

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Agreement not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'agreement_deleted',
      resourceId: partnerId,
      meta: { agreementId },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting agreement', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
