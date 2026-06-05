import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities, opportunityComments, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateOpportunityStatusSchema } from '@@/shared/schemas/opportunity'

/**
 * S7 — Move an opportunity between Pending / Accepted / Rejected.
 *
 * Side effects:
 *   - Accepting an opp auto-creates a Proposal in 'writing' status if one
 *     doesn't already exist for that opp. The proposal inherits the opp's
 *     title and deadline; the proposal team takes it from there.
 *   - Rejecting requires a comment; the API inserts it into the comments
 *     thread so the rationale is visible to every reviewer.
 *   - An optional comment on any status change is recorded the same way.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const parsed = updateOpportunityStatusSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid status payload',
      })
    }

    const { status, comment } = parsed.data
    const db = useDrizzle()

    const [existing] = await db
      .select({
        id: opportunities.id,
        status: opportunities.status,
        title: opportunities.title,
        deadline: opportunities.deadline,
      })
      .from(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    if (existing.status === status && !comment) {
      return { success: true, opportunity: existing }
    }

    const result = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(opportunities)
        .set({ status, updatedAt: new Date() })
        .where(eq(opportunities.id, id))
        .returning()

      // Drop reviewer commentary into the timeline. Rejection always gets one
      // (the schema enforces presence); other transitions append only when
      // the caller supplied a note.
      if (comment && comment.trim().length > 0) {
        await tx.insert(opportunityComments).values({
          opportunityId: id,
          organizationId: ctx.organizationId,
          kind: 'comment',
          body: comment.trim(),
          createdByUserId: ctx.userId,
        })
      }

      // Auto-spawn a proposal when accepting — but only once per opp. If the
      // team rejects and later re-accepts, they can keep working in the same
      // proposal record.
      let createdProposalId: string | null = null
      if (status === 'accepted' && existing.status !== 'accepted') {
        const [existingProposal] = await tx
          .select({ id: proposals.id })
          .from(proposals)
          .where(eq(proposals.opportunityId, id))
          .limit(1)
        if (!existingProposal) {
          const [proposal] = await tx
            .insert(proposals)
            .values({
              opportunityId: id,
              organizationId: ctx.organizationId,
              title: existing.title,
              status: 'writing',
              deadline: existing.deadline ?? null,
              createdByUserId: ctx.userId,
            })
            .returning({ id: proposals.id })
          createdProposalId = proposal?.id ?? null
        } else {
          createdProposalId = existingProposal.id
        }
      }

      return { row, createdProposalId }
    })

    if (!result.row) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'status_change',
      resourceId: id,
      meta: {
        from: existing.status,
        to: status,
        proposalCreated: result.createdProposalId,
        commentAttached: !!comment,
      },
    })

    return {
      success: true,
      opportunity: result.row,
      proposalId: result.createdProposalId,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating opportunity status', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
