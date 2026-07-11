import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { performanceFeedback, performanceReviews } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission, requireUser } from '@@/server/utils/permission-guard'
import { feedbackSchema } from '@@/shared/schemas/hr'

/** HR-05 — submit 360° feedback (one per reviewer per review, upsert). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, feedbackSchema.parse)
    // A reviewer may submit their own feedback; logging it for someone else needs HR.
    if (body.reviewerUserId !== ctx.userId) await requirePermission(event, 'hr', 'update')
    const db = useDrizzle()

    const [review] = await db
      .select({ id: performanceReviews.id })
      .from(performanceReviews)
      .where(
        and(
          eq(performanceReviews.id, id),
          eq(performanceReviews.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!review) throw createError({ statusCode: 404, statusMessage: 'Review not found' })

    const values = {
      organizationId: ctx.organizationId,
      reviewId: id,
      reviewerUserId: body.reviewerUserId,
      relationship: body.relationship,
      rating: body.rating ?? null,
      strengths: body.strengths ?? null,
      improvements: body.improvements ?? null,
      comments: body.comments ?? null,
      submittedAt: new Date(),
    }
    const [saved] = await db
      .insert(performanceFeedback)
      .values(values)
      .onConflictDoUpdate({
        target: [performanceFeedback.reviewId, performanceFeedback.reviewerUserId],
        set: {
          relationship: values.relationship,
          rating: values.rating,
          strengths: values.strengths,
          improvements: values.improvements,
          comments: values.comments,
          submittedAt: values.submittedAt,
        },
      })
      .returning()
    return { success: true, feedback: saved }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error submitting feedback', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
