import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities, proposalAssignments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { resolveProposalSettings } from '@@/server/utils/proposal-settings'
import { userHasPermission } from '@@/server/utils/role'

/** S7 — Proposal detail bundle. Includes opportunity context so the proposal
 *  page can show "writing for: <opp title>" without a second fetch. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal id is required' })

    const db = useDrizzle()

    const [row] = await db
      .select({
        id: proposals.id,
        opportunityId: proposals.opportunityId,
        organizationId: proposals.organizationId,
        title: proposals.title,
        status: proposals.status,
        reviewMinReviewers: proposals.reviewMinReviewers,
        reviewRule: proposals.reviewRule,
        reviewThreshold: proposals.reviewThreshold,
        requireFinalApprover: proposals.requireFinalApprover,
        rolesOverride: proposals.rolesOverride,
        outcomeStagesOverride: proposals.outcomeStagesOverride,
        evaluationStage: proposals.evaluationStage,
        deadline: proposals.deadline,
        contentDraft: proposals.contentDraft,
        brainstorm: proposals.brainstorm,
        writingMode: proposals.writingMode,
        submissionReference: proposals.submissionReference,
        submissionChannel: proposals.submissionChannel,
        submittedAt: proposals.submittedAt,
        decidedAt: proposals.decidedAt,
        decisionNote: proposals.decisionNote,
        reminderRecipientUserIds: proposals.reminderRecipientUserIds,
        createdByUserId: proposals.createdByUserId,
        createdAt: proposals.createdAt,
        updatedAt: proposals.updatedAt,
        opportunityTitle: opportunities.title,
        opportunityStatus: opportunities.status,
        opportunityDescription: opportunities.description,
        opportunityValue: opportunities.estimatedValue,
        opportunityCurrency: opportunities.currency,
        opportunityDeadline: opportunities.deadline,
        opportunityWinProbability: opportunities.winProbability,
        opportunityTags: opportunities.tags,
        createdByFirstName: users.firstName,
        createdByLastName: users.lastName,
      })
      .from(proposals)
      .leftJoin(users, eq(users.id, proposals.createdByUserId))
      .innerJoin(opportunities, eq(opportunities.id, proposals.opportunityId))
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)

    if (!row) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    // Need-to-know: only members (creator or an assignee) may open a proposal,
    // unless they hold oversight (system admin or `proposal:admin`).
    const canViewAll =
      ctx.isSystemAdmin || (await userHasPermission(ctx.userId, 'proposal', 'admin'))
    if (!canViewAll && row.createdByUserId !== ctx.userId) {
      const [member] = await db
        .select({ one: proposalAssignments.proposalId })
        .from(proposalAssignments)
        .where(
          and(
            eq(proposalAssignments.proposalId, id),
            eq(proposalAssignments.assignedUserId, ctx.userId)
          )
        )
        .limit(1)
      if (!member) {
        throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })
      }
    }

    // Resolved settings for this proposal (override → org → defaults).
    const settings = await resolveProposalSettings(row)

    return { proposal: row, settings }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching proposal', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
