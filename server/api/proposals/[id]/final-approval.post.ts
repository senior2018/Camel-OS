import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { proposalAssignments, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { postProposalSystemMessage } from '@@/server/utils/proposal-conversation'
import { requirePermission } from '@@/server/utils/permission-guard'

const bodySchema = z
  .object({
    decision: z.enum(['approved', 'rejected']),
    note: z.string().trim().max(2000).optional().nullable(),
  })
  // A final rejection must carry a reason (consistent with reviewer/loss).
  .refine((v) => v.decision !== 'rejected' || (v.note && v.note.trim().length > 0), {
    message: 'A reason is required to reject at final approval',
    path: ['note'],
  })

/**
 * The assigned Final Approver signs off once all reviewers have aligned.
 *   approved → final_approved (cleared to submit)
 *   rejected → final_rejected (stopped)
 * Only the user assigned to the `final_approver` role may act.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const { decision, note } = bodySchema.parse(await readBody(event))
    const db = useDrizzle()

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)

    if (!proposal) {
      throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })
    }

    if (
      proposal.status !== 'ready_for_final_approval' &&
      proposal.status !== 'awaiting_final_approval'
    ) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Proposal is not awaiting final approval',
      })
    }

    // Must be the assigned final approver.
    const [approver] = await db
      .select()
      .from(proposalAssignments)
      .where(
        and(
          eq(proposalAssignments.proposalId, id),
          eq(proposalAssignments.roleType, 'final_approver'),
          eq(proposalAssignments.assignedUserId, ctx.userId)
        )
      )
      .limit(1)

    if (!approver) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the assigned final approver can sign off',
      })
    }

    const newStatus = decision === 'approved' ? 'final_approved' : 'final_rejected'

    const [updated] = await db
      .update(proposals)
      .set({
        status: newStatus,
        decisionNote: note ?? proposal.decisionNote,
        decidedAt: new Date(),
      })
      .where(eq(proposals.id, id))
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'final_approval',
      resourceId: id,
      meta: { decision, newStatus },
    })

    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:final_approval',
      details: { decision, newStatus, note: note ?? null },
    })

    await postProposalSystemMessage({
      proposalId: id,
      organizationId: ctx.organizationId,
      body:
        decision === 'approved'
          ? `Final approval granted — cleared to submit${note ? `: "${note}"` : ''}`
          : `Final approval rejected${note ? `: "${note}"` : ''}`,
      eventType: 'final_approval',
      actorUserId: ctx.userId,
    }).catch(() => {})

    return { success: true, proposal: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in final approval', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
