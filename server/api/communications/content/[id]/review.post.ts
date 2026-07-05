import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentComments, contentItems, contentReviews, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { notifyContentDecision } from '@@/server/utils/content-notify'
import { getContentReviewPolicy } from '@@/server/utils/content-review-policy'
import { contentApprovalMet } from '@@/shared/schemas/communication-settings'
import { reviewDecisionSchema } from '@@/shared/schemas/communication'

/**
 * CC-03 — a reviewer approves / requests changes / rejects, with a comment.
 * The decision is timestamped and attributed; the content status is recomputed
 * from the full reviewer set; the author is notified immediately.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'approve')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const body = await readValidatedBody(event, reviewDecisionSchema.parse)
    const db = useDrizzle()

    const [item] = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        status: contentItems.status,
        authorUserId: contentItems.authorUserId,
      })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Content not found' })
    if (item.status !== 'in_review') {
      throw createError({ statusCode: 409, statusMessage: 'This content is not in review.' })
    }

    const [mine] = await db
      .select({ id: contentReviews.id })
      .from(contentReviews)
      .where(
        and(eq(contentReviews.contentItemId, id), eq(contentReviews.reviewerUserId, ctx.userId))
      )
      .limit(1)
    if (!mine) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not a reviewer on this content.',
      })
    }

    await db
      .update(contentReviews)
      .set({ decision: body.decision, comment: body.comment ?? null, decidedAt: new Date() })
      .where(eq(contentReviews.id, mine.id))

    // Recompute content status from all reviewer decisions, applying the org's
    // approval rule (all / at least N / percentage).
    const all = await db
      .select({ decision: contentReviews.decision })
      .from(contentReviews)
      .where(eq(contentReviews.contentItemId, id))
    const policy = await getContentReviewPolicy(ctx.organizationId)
    const anyBlocking = all.some(
      (r) => r.decision === 'rejected' || r.decision === 'changes_requested'
    )
    const approvalMet = contentApprovalMet(all, policy)
    const newStatus = anyBlocking ? 'changes_requested' : approvalMet ? 'approved' : 'in_review'

    if (newStatus !== item.status) {
      await db
        .update(contentItems)
        .set({ status: newStatus, updatedAt: new Date() })
        .where(eq(contentItems.id, id))
    }

    const [me] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, ctx.userId))
      .limit(1)
    const who = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || me?.email || 'A reviewer'
    const verb =
      body.decision === 'approved'
        ? 'approved'
        : body.decision === 'rejected'
          ? 'rejected'
          : 'requested changes'
    await db.insert(contentComments).values({
      contentItemId: id,
      organizationId: ctx.organizationId,
      authorUserId: null,
      body: `${who} ${verb}${body.comment ? `: ${body.comment}` : '.'}`,
    })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'approve',
      resourceId: id,
      meta: { decision: body.decision, newStatus },
    })

    await notifyContentDecision(
      { id, title: item.title, organizationId: ctx.organizationId },
      item.authorUserId,
      ctx.userId,
      body.decision,
      body.comment ?? null
    )

    return { success: true, status: newStatus }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error recording content review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
