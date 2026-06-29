import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { campaigns } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateCampaignSchema } from '@@/shared/schemas/communication'

/** Update a campaign (CC-09/CC-12). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Campaign ID is required' })
    const data = await readValidatedBody(event, updateCampaignSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Campaign not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) updates.name = data.name
    if (data.objective !== undefined) updates.objective = data.objective ?? null
    if (data.audience !== undefined) updates.audience = data.audience ?? null
    if (data.startDate !== undefined) updates.startDate = data.startDate ?? null
    if (data.endDate !== undefined) updates.endDate = data.endDate ?? null
    if (data.budgetPlanned !== undefined)
      updates.budgetPlanned = data.budgetPlanned != null ? String(data.budgetPlanned) : null
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.ownerUserId !== undefined) updates.ownerUserId = data.ownerUserId ?? null
    if (data.status !== undefined) updates.status = data.status

    const [updated] = await db
      .update(campaigns)
      .set(updates)
      .where(eq(campaigns.id, id))
      .returning()
    return { success: true, campaign: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating campaign', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
