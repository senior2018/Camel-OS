import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { contentItems, contentReviews, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** A single content item plus its approval-workflow reviewers (team only). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const db = useDrizzle()
    const [item] = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        type: contentItems.type,
        category: contentItems.category,
        excerpt: contentItems.excerpt,
        body: contentItems.body,
        coverImageUrl: contentItems.coverImageUrl,
        tags: contentItems.tags,
        status: contentItems.status,
        authorUserId: contentItems.authorUserId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        scheduledFor: contentItems.scheduledFor,
        campaignId: contentItems.campaignId,
        publishedAt: contentItems.publishedAt,
        platform: contentItems.platform,
        publishedUrl: contentItems.publishedUrl,
        isPaid: contentItems.isPaid,
        spend: contentItems.spend,
        metrics: contentItems.metrics,
        createdAt: contentItems.createdAt,
        updatedAt: contentItems.updatedAt,
      })
      .from(contentItems)
      .leftJoin(users, eq(users.id, contentItems.authorUserId))
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)

    if (!item) throw createError({ statusCode: 404, statusMessage: 'Content not found' })

    const reviews = await db
      .select({
        id: contentReviews.id,
        reviewerUserId: contentReviews.reviewerUserId,
        reviewerFirstName: users.firstName,
        reviewerLastName: users.lastName,
        stepOrder: contentReviews.stepOrder,
        decision: contentReviews.decision,
        comment: contentReviews.comment,
        decidedAt: contentReviews.decidedAt,
      })
      .from(contentReviews)
      .leftJoin(users, eq(users.id, contentReviews.reviewerUserId))
      .where(eq(contentReviews.contentItemId, id))
      .orderBy(asc(contentReviews.stepOrder), asc(contentReviews.createdAt))

    return { content: item, reviews }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching content item', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
