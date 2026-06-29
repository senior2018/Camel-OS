import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentItems, contentMetrics } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { contentMetricSchema } from '@@/shared/schemas/communication'

/** CC-08 — record (upsert) one date's engagement metrics for a content item. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })
    const body = await readValidatedBody(event, contentMetricSchema.parse)
    const db = useDrizzle()

    const [item] = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Content not found' })

    await db
      .insert(contentMetrics)
      .values({
        contentItemId: id,
        organizationId: ctx.organizationId,
        metricDate: body.metricDate,
        impressions: body.impressions,
        clicks: body.clicks,
        shares: body.shares,
        likes: body.likes,
      })
      .onConflictDoUpdate({
        target: [contentMetrics.contentItemId, contentMetrics.metricDate],
        set: {
          impressions: body.impressions,
          clicks: body.clicks,
          shares: body.shares,
          likes: body.likes,
        },
      })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving content metric', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
