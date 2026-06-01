import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clients, partnershipAgreements } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createAgreementSchema } from '@@/shared/schemas/partnership'

/**
 * CR-11 — Record a partnership agreement for a partner client. The renewal
 * cron looks at `endDate` to fire 90- and 30-day notifications; both stamps
 * start null so a fresh row immediately participates in the next sweep.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const partnerId = getRouterParam(event, 'id')
    if (!partnerId) {
      throw createError({ statusCode: 400, statusMessage: 'Partner id is required' })
    }

    const parsed = createAgreementSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid agreement payload',
      })
    }

    const db = useDrizzle()
    const [partner] = await db
      .select({ id: clients.id, type: clients.type })
      .from(clients)
      .where(and(eq(clients.id, partnerId), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)
    if (!partner) throw createError({ statusCode: 404, statusMessage: 'Partner not found' })

    const data = parsed.data
    const [created] = await db
      .insert(partnershipAgreements)
      .values({
        partnerId,
        organizationId: ctx.organizationId,
        title: data.title,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        value: data.value ?? null,
        currency: data.currency,
        status: data.status,
        documentUrl: data.documentUrl ?? null,
        notes: data.notes ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    if (!created) throw new Error('Failed to create agreement')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'agreement_created',
      resourceId: partnerId,
      meta: { agreementId: created.id, title: created.title, endDate: created.endDate },
    })

    return { success: true, agreement: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating partnership agreement', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
