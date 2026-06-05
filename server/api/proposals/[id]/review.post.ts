import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalReviewers, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit-log'
import { requirePermission } from '@@/server/utils/permission-guard'
import { submitProposalReviewSchema } from '@@/shared/schemas/proposal-review'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })
    }

    const body = await readBody(event)
    const payload = submitProposalReviewSchema.parse(body)

    const db = useDrizzle()

    // Check if proposal exists
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)

    if (!proposal) {
      throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })
    }

    // Check if reviewer record exists
    const [reviewer] = await db
      .select()
      .from(proposalReviewers)
      .where(
        and(
          eq(proposalReviewers.proposalId, id),
          eq(proposalReviewers.reviewerUserId, ctx.userId)
        )
      )
      .limit(1)

    if (!reviewer) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You are not assigned as a reviewer for this proposal',
      })
    }

    // Update reviewer decision
    const [updatedReviewer] = await db
      .update(proposalReviewers)
      .set({
        status: payload.status,
        feedback: payload.feedback,
        decidedAt: new Date(),
      })
      .where(eq(proposalReviewers.id, reviewer.id))
      .returning()

    // Check all reviewers' decisions to update proposal status
    const allReviewers = await db
      .select()
      .from(proposalReviewers)
      .where(eq(proposalReviewers.proposalId, id))

    const pendingCount = allReviewers.filter((r) => r.status === 'pending').length
    const rejectedCount = allReviewers.filter((r) => r.status === 'rejected').length
    const changesRequiredCount = allReviewers.filter((r) => r.status === 'changes_required').length
    const approvedCount = allReviewers.filter(
      (r) => r.status === 'approved' && r.isRequired
    ).length
    const requiredReviewerCount = allReviewers.filter((r) => r.isRequired).length

    let newProposalStatus = proposal.status

    // Determine new proposal status based on all decisions
    if (rejectedCount > 0) {
      newProposalStatus = 'rejected'
    } else if (changesRequiredCount > 0) {
      newProposalStatus = 'revision_required'
    } else if (pendingCount === 0 && approvedCount === requiredReviewerCount) {
      // All required reviewers have approved
      newProposalStatus = 'ready_for_final_approval'
    }

    // Update proposal status if it changed
    if (newProposalStatus !== proposal.status) {
      await db
        .update(proposals)
        .set({ status: newProposalStatus as any })
        .where(eq(proposals.id, id))
    }

    // Log audit event
    await logAuditEvent({
      event,
      action: 'proposal:review',
      details: {
        proposalId: id,
        reviewerDecision: payload.status,
        feedback: payload.feedback,
        newProposalStatus,
      },
    })

    return {
      success: true,
      reviewer: updatedReviewer,
      proposalStatus: newProposalStatus,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error submitting review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
