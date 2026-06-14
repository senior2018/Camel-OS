import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalSectionComments, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** Delete a comment — author or a system admin only. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    const commentId = getRouterParam(event, 'commentId')
    if (!id || !commentId) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal and comment ID are required' })
    }

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const [comment] = await db
      .select({ createdByUserId: proposalSectionComments.createdByUserId })
      .from(proposalSectionComments)
      .where(
        and(eq(proposalSectionComments.id, commentId), eq(proposalSectionComments.proposalId, id))
      )
      .limit(1)
    if (!comment) throw createError({ statusCode: 404, statusMessage: 'Comment not found' })

    if (!ctx.isSystemAdmin && comment.createdByUserId !== ctx.userId) {
      throw createError({ statusCode: 403, statusMessage: 'You can only delete your own comment' })
    }

    await db.delete(proposalSectionComments).where(eq(proposalSectionComments.id, commentId))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting proposal comment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
