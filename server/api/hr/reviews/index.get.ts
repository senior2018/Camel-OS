import { consola } from 'consola'
import { desc, eq, sql } from 'drizzle-orm'

import { performanceFeedback, performanceReviews, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HR-05 — performance reviews with subject name + feedback count. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const rows = await useDrizzle()
      .select({
        id: performanceReviews.id,
        subjectUserId: performanceReviews.subjectUserId,
        firstName: users.firstName,
        lastName: users.lastName,
        periodLabel: performanceReviews.periodLabel,
        status: performanceReviews.status,
        overallRating: performanceReviews.overallRating,
        feedbackCount: sql<number>`count(${performanceFeedback.id})::int`,
        createdAt: performanceReviews.createdAt,
      })
      .from(performanceReviews)
      .leftJoin(users, eq(users.id, performanceReviews.subjectUserId))
      .leftJoin(performanceFeedback, eq(performanceFeedback.reviewId, performanceReviews.id))
      .where(eq(performanceReviews.organizationId, ctx.organizationId))
      .groupBy(performanceReviews.id, users.firstName, users.lastName)
      .orderBy(desc(performanceReviews.createdAt))
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing reviews', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
