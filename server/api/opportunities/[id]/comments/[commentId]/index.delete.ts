import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunityComments } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * S7 — Delete a comment. Author can remove their own; admins (opportunity:admin)
 * can remove anyone's. Soft-delete would be safer for audit, but the audit_log
 * already records the creation event so deletion is fine for v1.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const id = getRouterParam(event, 'id')
    const commentId = getRouterParam(event, 'commentId')
    if (!id || !commentId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Opportunity + comment ids are required',
      })
    }

    const db = useDrizzle()
    const [comment] = await db
      .select({
        id: opportunityComments.id,
        createdByUserId: opportunityComments.createdByUserId,
      })
      .from(opportunityComments)
      .where(
        and(
          eq(opportunityComments.id, commentId),
          eq(opportunityComments.opportunityId, id),
          eq(opportunityComments.organizationId, ctx.organizationId)
        )
      )
      .limit(1)

    if (!comment) throw createError({ statusCode: 404, statusMessage: 'Comment not found' })

    // Owner-only delete (or someone with explicit opportunity:admin).
    const isAuthor = comment.createdByUserId === ctx.userId
    if (!isAuthor) {
      // Require admin permission to delete others' comments.
      await requirePermission(event, 'opportunity', 'admin')
    }

    await db.delete(opportunityComments).where(eq(opportunityComments.id, commentId))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'comment_deleted',
      resourceId: id,
      meta: { commentId },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting comment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
