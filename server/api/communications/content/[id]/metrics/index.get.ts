import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { contentMetrics } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** CC-08 — engagement metrics for a content item, oldest first, with totals. */
export default defineEventHandler(async (event) => {
  try {
    await requireContentTeam(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const rows = await useDrizzle()
      .select()
      .from(contentMetrics)
      .where(eq(contentMetrics.contentItemId, id))
      .orderBy(asc(contentMetrics.metricDate))

    const totals = rows.reduce(
      (acc, r) => ({
        impressions: acc.impressions + r.impressions,
        clicks: acc.clicks + r.clicks,
        shares: acc.shares + r.shares,
        likes: acc.likes + r.likes,
      }),
      { impressions: 0, clicks: 0, shares: 0, likes: 0 }
    )
    const engagement = totals.clicks + totals.shares + totals.likes

    return { metrics: rows, totals: { ...totals, engagement } }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading content metrics', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
