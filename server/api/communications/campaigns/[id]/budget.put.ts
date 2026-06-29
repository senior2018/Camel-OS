import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { campaignBudgetLines, campaigns } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { campaignBudgetSchema } from '@@/shared/schemas/communication'

/** CC-12 — replace the campaign's budget lines (planned vs actual spend). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Campaign ID is required' })
    const body = await readValidatedBody(event, campaignBudgetSchema.parse)
    const db = useDrizzle()

    const [campaign] = await db
      .select({ id: campaigns.id })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, ctx.organizationId)))
      .limit(1)
    if (!campaign) throw createError({ statusCode: 404, statusMessage: 'Campaign not found' })

    await db.delete(campaignBudgetLines).where(eq(campaignBudgetLines.campaignId, id))
    if (body.lines.length) {
      await db.insert(campaignBudgetLines).values(
        body.lines.map((l) => ({
          campaignId: id,
          organizationId: ctx.organizationId,
          label: l.label,
          plannedAmount: String(l.plannedAmount),
          actualAmount: String(l.actualAmount),
        }))
      )
    }

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving campaign budget', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
