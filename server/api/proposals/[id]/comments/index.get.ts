import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { proposalSectionComments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** List all section comments for a proposal (grouped client-side by section). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const comments = await db
      .select({
        id: proposalSectionComments.id,
        sectionId: proposalSectionComments.sectionId,
        parentCommentId: proposalSectionComments.parentCommentId,
        body: proposalSectionComments.body,
        createdAt: proposalSectionComments.createdAt,
        createdByUserId: proposalSectionComments.createdByUserId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        authorEmail: users.email,
      })
      .from(proposalSectionComments)
      .leftJoin(users, eq(users.id, proposalSectionComments.createdByUserId))
      .where(eq(proposalSectionComments.proposalId, id))
      .orderBy(asc(proposalSectionComments.createdAt))

    return { comments }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing proposal comments', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
