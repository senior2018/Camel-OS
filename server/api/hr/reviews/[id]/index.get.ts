import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { performanceFeedback, performanceReviews, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission, requireUser } from '@@/server/utils/permission-guard'

/** HR-05 — a review with all 360° feedback. Subject may view their own. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const db = useDrizzle()

    const [review] = await db
      .select({
        id: performanceReviews.id,
        subjectUserId: performanceReviews.subjectUserId,
        subjectFirstName: users.firstName,
        subjectLastName: users.lastName,
        periodLabel: performanceReviews.periodLabel,
        status: performanceReviews.status,
        overallRating: performanceReviews.overallRating,
        summary: performanceReviews.summary,
      })
      .from(performanceReviews)
      .leftJoin(users, eq(users.id, performanceReviews.subjectUserId))
      .where(
        and(
          eq(performanceReviews.id, id),
          eq(performanceReviews.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!review) throw createError({ statusCode: 404, statusMessage: 'Review not found' })
    if (review.subjectUserId !== ctx.userId) await requirePermission(event, 'hr', 'read')

    const reviewer = users
    const feedback = await db
      .select({
        id: performanceFeedback.id,
        reviewerUserId: performanceFeedback.reviewerUserId,
        firstName: reviewer.firstName,
        lastName: reviewer.lastName,
        relationship: performanceFeedback.relationship,
        rating: performanceFeedback.rating,
        strengths: performanceFeedback.strengths,
        improvements: performanceFeedback.improvements,
        comments: performanceFeedback.comments,
        submittedAt: performanceFeedback.submittedAt,
      })
      .from(performanceFeedback)
      .leftJoin(reviewer, eq(reviewer.id, performanceFeedback.reviewerUserId))
      .where(eq(performanceFeedback.reviewId, id))
      .orderBy(asc(performanceFeedback.createdAt))

    return { review, feedback }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
