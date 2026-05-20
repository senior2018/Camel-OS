import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunityAttachments } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { OPPORTUNITY_ATTACHMENTS_BUCKET, useSupabaseStorage } from '@@/server/utils/storage'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const opportunityId = getRouterParam(event, 'id')
    const attachmentId = getRouterParam(event, 'attachmentId')
    if (!opportunityId || !attachmentId) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request' })
    }

    const db = useDrizzle()

    const [attachment] = await db
      .select()
      .from(opportunityAttachments)
      .where(
        and(
          eq(opportunityAttachments.id, attachmentId),
          eq(opportunityAttachments.opportunityId, opportunityId),
          eq(opportunityAttachments.organizationId, ctx.organizationId)
        )
      )
      .limit(1)

    if (!attachment) {
      throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })
    }

    // Best-effort storage delete — if it fails the DB row still goes so the UI
    // stays consistent. Orphaned files can be cleaned up by a janitor task.
    const { error: removeErr } = await useSupabaseStorage()
      .storage.from(OPPORTUNITY_ATTACHMENTS_BUCKET)
      .remove([attachment.storagePath])
    if (removeErr) {
      consola.warn(`Storage delete failed for ${attachment.storagePath}:`, removeErr.message)
    }

    await db.delete(opportunityAttachments).where(eq(opportunityAttachments.id, attachmentId))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'attachment_deleted',
      resourceId: opportunityId,
      meta: { fileName: attachment.fileName, attachmentId },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting attachment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
