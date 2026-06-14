import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalSectionComments, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createProposalCommentSchema } from '@@/shared/schemas/proposal-section-comment'

/**
 * Post a section comment. Anyone who can view the proposal (proposal:read) may
 * comment — reviewers leave feedback, writers reply. Threaded via parentCommentId.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const payload = createProposalCommentSchema.parse(await readBody(event))
    const db = useDrizzle()

    const [proposal] = await db
      .select({ id: proposals.id, opportunityId: proposals.opportunityId })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const [comment] = await db
      .insert(proposalSectionComments)
      .values({
        proposalId: id,
        sectionId: payload.sectionId ?? null,
        parentCommentId: payload.parentCommentId ?? null,
        organizationId: ctx.organizationId,
        body: payload.body,
        createdByUserId: ctx.userId,
      })
      .returning()

    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:comment',
      details: { sectionId: payload.sectionId ?? null },
    })

    return { success: true, comment }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error posting proposal comment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
