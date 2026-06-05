import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalReviewers, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })
    }

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

    const reviewers = await db
      .select({
        id: proposalReviewers.id,
        reviewerUserId: proposalReviewers.reviewerUserId,
        reviewerRole: proposalReviewers.reviewerRole,
        isRequired: proposalReviewers.isRequired,
        status: proposalReviewers.status,
        feedback: proposalReviewers.feedback,
        decidedAt: proposalReviewers.decidedAt,
        createdAt: proposalReviewers.createdAt,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(proposalReviewers)
      .leftJoin(users, eq(users.id, proposalReviewers.reviewerUserId))
      .where(eq(proposalReviewers.proposalId, id))

    return {
      reviewers,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching reviewers', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
