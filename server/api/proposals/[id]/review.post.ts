import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalReviewers, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { requirePermission } from '@@/server/utils/permission-guard'
import { submitProposalReviewSchema } from '@@/shared/schemas/proposal-review'

/**
 * A reviewer submits their decision. After saving it we recompute the proposal
 * status from ALL reviewer rows (Option A — every required reviewer must align):
 *   - any rejected            → rejected
 *   - any changes_required    → revision_required
 *   - all required approved   → ready_for_final_approval
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const payload = submitProposalReviewSchema.parse(await readBody(event))
    const db = useDrizzle()

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)

    if (!proposal) {
      throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })
    }

    const [reviewer] = await db
      .select()
      .from(proposalReviewers)
      .where(
        and(eq(proposalReviewers.proposalId, id), eq(proposalReviewers.reviewerUserId, ctx.userId))
      )
      .limit(1)

    if (!reviewer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not assigned as a reviewer for this proposal',
      })
    }

    await db
      .update(proposalReviewers)
      .set({ status: payload.status, feedback: payload.feedback, decidedAt: new Date() })
      .where(eq(proposalReviewers.id, reviewer.id))

    // Recompute proposal status from the full reviewer set.
    const all = await db
      .select()
      .from(proposalReviewers)
      .where(eq(proposalReviewers.proposalId, id))

    const pending = all.filter((r) => r.status === 'pending').length
    const rejected = all.filter((r) => r.status === 'rejected').length
    const changes = all.filter((r) => r.status === 'changes_required').length
    const requiredApproved = all.filter((r) => r.isRequired && r.status === 'approved').length
    const requiredTotal = all.filter((r) => r.isRequired).length

    let newStatus = proposal.status
    if (rejected > 0) newStatus = 'rejected'
    else if (changes > 0) newStatus = 'revision_required'
    // PM-05 — all required reviewers approved AND at least 3 approvals.
    else if (pending === 0 && requiredApproved === requiredTotal && requiredApproved >= 3)
      newStatus = 'ready_for_final_approval'

    if (newStatus !== proposal.status) {
      await db.update(proposals).set({ status: newStatus }).where(eq(proposals.id, id))
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'review',
      resourceId: id,
      meta: { decision: payload.status, newStatus },
    })

    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:review',
      details: { reviewerDecision: payload.status, role: reviewer.reviewerRole, newStatus },
    })

    return { success: true, proposalStatus: newStatus }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error submitting review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
