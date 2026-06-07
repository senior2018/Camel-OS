import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'

import { proposalAssignments, proposalReviewers, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { requirePermission } from '@@/server/utils/permission-guard'

const REVIEWER_ROLES = ['technical_reviewer', 'finance_reviewer', 'compliance_reviewer'] as const

/**
 * The Lead marks the proposal ready for review. We materialise a
 * `proposal_reviewers` row (status pending) for every assigned reviewer role,
 * then move the proposal to `awaiting_review`. Re-running this (after a revision
 * cycle) resets every reviewer back to pending.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const db = useDrizzle()

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)

    if (!proposal) {
      throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })
    }

    if (proposal.status !== 'drafting' && proposal.status !== 'revision_required') {
      throw createError({
        statusCode: 400,
        statusMessage: `Proposal must be drafting or in revision to send for review (currently: ${proposal.status})`,
      })
    }

    // Pull the assigned reviewer-role people.
    const reviewerAssignments = await db
      .select()
      .from(proposalAssignments)
      .where(
        and(
          eq(proposalAssignments.proposalId, id),
          inArray(proposalAssignments.roleType, [...REVIEWER_ROLES])
        )
      )

    if (reviewerAssignments.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Assign at least one reviewer (technical, finance, or compliance) first',
      })
    }

    // Reset the review round: clear prior reviewer rows and recreate as pending.
    await db.delete(proposalReviewers).where(eq(proposalReviewers.proposalId, id))
    await db.insert(proposalReviewers).values(
      reviewerAssignments.map((a) => ({
        proposalId: id,
        organizationId: ctx.organizationId,
        reviewerUserId: a.assignedUserId,
        reviewerRole: a.roleType,
        isRequired: true,
        status: 'pending' as const,
      }))
    )

    const [updated] = await db
      .update(proposals)
      .set({ status: 'awaiting_review' })
      .where(eq(proposals.id, id))
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'ready_for_review',
      resourceId: id,
      meta: { reviewerCount: reviewerAssignments.length },
    })

    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:ready_for_review',
      details: { reviewerCount: reviewerAssignments.length },
    })

    return { success: true, proposal: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error marking proposal ready for review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
