import { consola } from 'consola'
import { and, desc, eq, isNotNull, sql } from 'drizzle-orm'

import { campaigns, contentItems, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** Campaign list with planned-vs-published content rollups (CC-09/CC-11). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const db = useDrizzle()

    const rows = await db
      .select({
        id: campaigns.id,
        name: campaigns.name,
        objective: campaigns.objective,
        status: campaigns.status,
        startDate: campaigns.startDate,
        endDate: campaigns.endDate,
        budgetPlanned: campaigns.budgetPlanned,
        currency: campaigns.currency,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        createdAt: campaigns.createdAt,
      })
      .from(campaigns)
      .leftJoin(users, eq(users.id, campaigns.ownerUserId))
      .where(eq(campaigns.organizationId, ctx.organizationId))
      .orderBy(desc(campaigns.createdAt))

    const counts = await db
      .select({
        campaignId: contentItems.campaignId,
        total: sql<number>`count(*)::int`,
        published: sql<number>`count(*) filter (where ${contentItems.status} = 'published')::int`,
      })
      .from(contentItems)
      .where(
        and(eq(contentItems.organizationId, ctx.organizationId), isNotNull(contentItems.campaignId))
      )
      .groupBy(contentItems.campaignId)
    const byCampaign = new Map(counts.map((c) => [c.campaignId, c]))

    return {
      items: rows.map((r) => ({
        ...r,
        contentTotal: byCampaign.get(r.id)?.total ?? 0,
        contentPublished: byCampaign.get(r.id)?.published ?? 0,
      })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing campaigns', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
