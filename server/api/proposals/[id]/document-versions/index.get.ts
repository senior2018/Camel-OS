import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { proposalDocumentVersions, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { canAccessProposal } from '@@/server/utils/proposal-conversation'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PM-03 — document version history (newest first), with author attribution. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const allowed = await canAccessProposal({
      proposalId: id,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      isSystemAdmin: ctx.isSystemAdmin,
    })
    if (!allowed) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const db = useDrizzle()
    // Guard org scope.
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const versions = await db
      .select({
        id: proposalDocumentVersions.id,
        content: proposalDocumentVersions.content,
        createdAt: proposalDocumentVersions.createdAt,
        savedByFirstName: users.firstName,
        savedByLastName: users.lastName,
      })
      .from(proposalDocumentVersions)
      .leftJoin(users, eq(users.id, proposalDocumentVersions.savedByUserId))
      .where(eq(proposalDocumentVersions.proposalId, id))
      .orderBy(desc(proposalDocumentVersions.createdAt))
      .limit(50)

    return { versions }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing document versions', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
