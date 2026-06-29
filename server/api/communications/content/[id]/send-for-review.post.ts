import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentComments, contentItems, contentReviews } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { notifyContentReviewers } from '@@/server/utils/content-notify'
import { assignReviewersSchema } from '@@/shared/schemas/communication'

/**
 * CC-02 — assign named reviewers and send a content item into the approval
 * workflow. Replaces any prior reviewer set, flips status to `in_review`,
 * records a system note, and notifies reviewers (email + in-app).
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const body = await readValidatedBody(event, assignReviewersSchema.parse)
    const db = useDrizzle()

    const [item] = await db
      .select({ id: contentItems.id, title: contentItems.title, status: contentItems.status })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Content not found' })
    if (!['draft', 'changes_requested'].includes(item.status)) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Only draft content can be sent for review.',
      })
    }

    // Unique reviewers.
    const seen = new Set<string>()
    for (const r of body.reviewers) {
      if (seen.has(r.userId)) {
        throw createError({ statusCode: 400, statusMessage: 'A reviewer was listed twice.' })
      }
      seen.add(r.userId)
    }

    await db.delete(contentReviews).where(eq(contentReviews.contentItemId, id))
    await db.insert(contentReviews).values(
      body.reviewers.map((r) => ({
        contentItemId: id,
        organizationId: ctx.organizationId,
        reviewerUserId: r.userId,
        stepOrder: r.stepOrder,
        decision: 'pending' as const,
      }))
    )

    await db
      .update(contentItems)
      .set({ status: 'in_review', updatedAt: new Date() })
      .where(eq(contentItems.id, id))

    await db.insert(contentComments).values({
      contentItemId: id,
      organizationId: ctx.organizationId,
      authorUserId: null,
      body: `Sent for review — ${body.reviewers.length} reviewer${body.reviewers.length === 1 ? '' : 's'} assigned.`,
    })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'update',
      resourceId: id,
      meta: { event: 'sent_for_review', reviewerCount: body.reviewers.length },
    })

    await notifyContentReviewers(
      { id, title: item.title, organizationId: ctx.organizationId },
      ctx.userId,
      body.reviewers.map((r) => r.userId)
    )

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error sending content for review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
