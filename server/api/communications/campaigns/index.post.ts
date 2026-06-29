import { consola } from 'consola'

import { campaigns } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createCampaignSchema } from '@@/shared/schemas/communication'

/** CC-09 — create a campaign (Communications Lead). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const body = await readValidatedBody(event, createCampaignSchema.parse)
    const db = useDrizzle()

    const [created] = await db
      .insert(campaigns)
      .values({
        organizationId: ctx.organizationId,
        name: body.name,
        objective: body.objective ?? null,
        audience: body.audience ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        budgetPlanned: body.budgetPlanned != null ? String(body.budgetPlanned) : null,
        currency: body.currency,
        ownerUserId: body.ownerUserId ?? ctx.userId,
        status: 'planning',
      })
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'create',
      resourceId: created!.id,
      meta: { kind: 'campaign', name: created!.name },
    })

    return { success: true, campaign: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating campaign', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
