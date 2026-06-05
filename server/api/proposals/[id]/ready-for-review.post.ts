import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalReviewers, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit-log'
import { requirePermission } from '@@/server/utils/permission-guard'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })
    }

    const db = useDrizzle()

    // Check if proposal exists and user is the proposal lead
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)

    if (!proposal) {
      throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })
    }

    // Check that proposal is in drafting status
    if (proposal.status !== 'drafting') {
      throw createError({
        statusCode: 400,
        statusMessage: `Proposal must be in drafting status, currently: ${proposal.status}`,
      })
    }

    // Check if there are any reviewers assigned
    const reviewers = await db
      .select()
      .from(proposalReviewers)
      .where(eq(proposalReviewers.proposalId, id))

    if (reviewers.length === 0) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Reviewers must be assigned before marking ready for review',
      })
    }

    // Reset all reviewers to pending status
    await db
      .update(proposalReviewers)
      .set({
        status: 'pending',
        feedback: null,
        decidedAt: null,
      })
      .where(eq(proposalReviewers.proposalId, id))

    // Update proposal status to awaiting_review
    const [updatedProposal] = await db
      .update(proposals)
      .set({
        status: 'awaiting_review',
      })
      .where(eq(proposals.id, id))
      .returning()

    // Log audit event
    await logAuditEvent({
      event,
      action: 'proposal:ready_for_review',
      details: {
        proposalId: id,
        reviewerCount: reviewers.length,
      },
    })

    return {
      success: true,
      proposal: updatedProposal,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error marking proposal ready for review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
