import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { performanceReviews } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { reviewUpdateSchema } from '@@/shared/schemas/hr'

/** HR-05 — update review status, overall rating, or summary. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, reviewUpdateSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: performanceReviews.id })
      .from(performanceReviews)
      .where(
        and(
          eq(performanceReviews.id, id),
          eq(performanceReviews.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Review not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.periodLabel !== undefined) updates.periodLabel = body.periodLabel ?? null
    if (body.status !== undefined) updates.status = body.status
    if (body.overallRating !== undefined) updates.overallRating = body.overallRating ?? null
    if (body.summary !== undefined) updates.summary = body.summary ?? null

    const [updated] = await db
      .update(performanceReviews)
      .set(updates)
      .where(eq(performanceReviews.id, id))
      .returning()
    return { success: true, review: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
