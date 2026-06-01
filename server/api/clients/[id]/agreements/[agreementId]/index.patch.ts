import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { partnershipAgreements } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateAgreementSchema } from '@@/shared/schemas/partnership'

/**
 * CR-11 — Update a partnership agreement. If `endDate` moves, both renewal
 * idempotency stamps are cleared so the cron can re-fire the 90- and 30-day
 * notifications for the new schedule.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const partnerId = getRouterParam(event, 'id')
    const agreementId = getRouterParam(event, 'agreementId')
    if (!partnerId || !agreementId) {
      throw createError({ statusCode: 400, statusMessage: 'Partner + agreement ids are required' })
    }

    const parsed = updateAgreementSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid agreement payload',
      })
    }

    const db = useDrizzle()

    const [existing] = await db
      .select()
      .from(partnershipAgreements)
      .where(
        and(
          eq(partnershipAgreements.id, agreementId),
          eq(partnershipAgreements.partnerId, partnerId),
          eq(partnershipAgreements.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Agreement not found' })

    const data = parsed.data
    const updates: Partial<typeof partnershipAgreements.$inferInsert> = {
      updatedAt: new Date(),
    }
    if (data.title !== undefined) updates.title = data.title
    if (data.startDate !== undefined) updates.startDate = data.startDate ?? null
    if (data.endDate !== undefined) {
      updates.endDate = data.endDate ?? null
      // Endpoint moved — let the cron re-fire both windows.
      if ((data.endDate ?? null) !== existing.endDate) {
        updates.renewalNotifiedAt90 = null
        updates.renewalNotifiedAt30 = null
      }
    }
    if (data.value !== undefined) updates.value = data.value ?? null
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.status !== undefined) updates.status = data.status
    if (data.documentUrl !== undefined) updates.documentUrl = data.documentUrl ?? null
    if (data.notes !== undefined) updates.notes = data.notes ?? null

    const [updated] = await db
      .update(partnershipAgreements)
      .set(updates)
      .where(eq(partnershipAgreements.id, agreementId))
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'agreement_updated',
      resourceId: partnerId,
      meta: { agreementId, fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
    })

    return { success: true, agreement: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating agreement', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
