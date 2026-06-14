import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

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
        title: proposals.title,
        status: proposals.status,
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

    return { proposal: row }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching proposal', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
