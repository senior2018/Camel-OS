import { consola } from 'consola'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { proposalAttachments, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { isProposalWriter } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'
import { OPPORTUNITY_ATTACHMENTS_BUCKET, useSupabaseStorage } from '@@/server/utils/storage'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

/**
 * S11 (PM-03 upload mode) — upload a proposal document (PDF/Word/Excel) + an
 * optional short brief. Writers only. Reuses the opportunity-attachments bucket
 * with a `proposals/<org>/<proposal>/` key prefix.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    if (!(await isProposalWriter(id, ctx.userId, ctx.isSystemAdmin))) {
      throw createError({ statusCode: 403, statusMessage: 'Only writers can upload documents' })
    }

    const form = await readMultipartFormData(event)
    const filePart = form?.find((p) => p.name === 'file' && p.filename)
    const briefPart = form?.find((p) => p.name === 'brief')
    if (!filePart?.data) throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
    if (filePart.data.length > MAX_FILE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'File exceeds the 25 MB limit' })
    }

    const originalName = (filePart.filename ?? 'upload').slice(0, 255)
    const mimeType = filePart.type ?? 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw createError({
        statusCode: 415,
        statusMessage: 'Only PDF, Word, and Excel files are supported.',
      })
    }

    const safeName = originalName.replace(/[^\w.-]/g, '_')
    const storageKey = `proposals/${ctx.organizationId}/${id}/${randomUUID()}-${safeName}`

    const { error: uploadErr } = await useSupabaseStorage()
      .storage.from(OPPORTUNITY_ATTACHMENTS_BUCKET)
      .upload(storageKey, filePart.data, { contentType: mimeType, upsert: false })
    if (uploadErr) {
      consola.error('Proposal storage upload failed', uploadErr)
      throw createError({ statusCode: 500, statusMessage: 'Failed to store the file.' })
    }

    const brief =
      typeof briefPart?.data !== 'undefined' ? briefPart.data.toString().slice(0, 2000) : null

    const [created] = await db
      .insert(proposalAttachments)
      .values({
        proposalId: id,
        organizationId: ctx.organizationId,
        fileName: originalName,
        storageKey,
        fileSize: filePart.data.length,
        mimeType,
        brief: brief || null,
        uploadedByUserId: ctx.userId,
      })
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'attachment_uploaded',
      resourceId: id,
      meta: { fileName: originalName, attachmentId: created?.id },
    })

    return { success: true, attachment: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error uploading proposal attachment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
