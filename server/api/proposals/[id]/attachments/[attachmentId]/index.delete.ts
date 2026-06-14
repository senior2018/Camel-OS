import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalAttachments, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { isProposalWriter } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'
import { OPPORTUNITY_ATTACHMENTS_BUCKET, useSupabaseStorage } from '@@/server/utils/storage'

/** Delete a proposal document (storage object + DB row). Writers only. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    const attachmentId = getRouterParam(event, 'attachmentId')
    if (!id || !attachmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal and attachment ID required' })
    }

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    if (!(await isProposalWriter(id, ctx.userId, ctx.isSystemAdmin))) {
      throw createError({ statusCode: 403, statusMessage: 'Only writers can delete documents' })
    }

    const [row] = await db
      .select({ storageKey: proposalAttachments.storageKey })
      .from(proposalAttachments)
      .where(and(eq(proposalAttachments.id, attachmentId), eq(proposalAttachments.proposalId, id)))
      .limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })

    await useSupabaseStorage().storage.from(OPPORTUNITY_ATTACHMENTS_BUCKET).remove([row.storageKey])
    await db.delete(proposalAttachments).where(eq(proposalAttachments.id, attachmentId))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'attachment_deleted',
      resourceId: id,
      meta: { attachmentId },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting proposal attachment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
