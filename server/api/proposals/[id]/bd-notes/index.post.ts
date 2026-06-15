import { consola } from 'consola'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { proposalBdNotes, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { requirePermission } from '@@/server/utils/permission-guard'
import { OPPORTUNITY_ATTACHMENTS_BUCKET, useSupabaseStorage } from '@@/server/utils/storage'
import { createBdNoteSchema } from '@@/shared/schemas/proposal-bd-note'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'image/png',
  'image/jpeg',
])

/**
 * S13 (BD-02) — log a client communication / evaluator feedback entry, with an
 * optional single file attachment (e.g. an evaluator's scoresheet). Always sent
 * as multipart so the file is optional but supported.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const form = await readMultipartFormData(event)
    const field = (name: string) =>
      form?.find((p) => p.name === name && !p.filename)?.data?.toString()
    const payload = createBdNoteSchema.parse({ kind: field('kind'), body: field('body') })

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id, opportunityId: proposals.opportunityId })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    // Optional attachment.
    let attachment: {
      attachmentStorageKey: string
      attachmentFileName: string
      attachmentMimeType: string
      attachmentFileSize: number
    } | null = null
    const filePart = form?.find((p) => p.name === 'file' && p.filename)
    if (filePart?.data?.length) {
      if (filePart.data.length > MAX_FILE_BYTES) {
        throw createError({ statusCode: 413, statusMessage: 'File exceeds the 25 MB limit' })
      }
      const mimeType = filePart.type ?? 'application/octet-stream'
      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        throw createError({
          statusCode: 415,
          statusMessage: 'Only PDF, Word, Excel, and image files are supported.',
        })
      }
      const originalName = (filePart.filename ?? 'upload').slice(0, 255)
      const safeName = originalName.replace(/[^\w.-]/g, '_')
      const storageKey = `proposals/${ctx.organizationId}/${id}/bd/${randomUUID()}-${safeName}`
      const { error: uploadErr } = await useSupabaseStorage()
        .storage.from(OPPORTUNITY_ATTACHMENTS_BUCKET)
        .upload(storageKey, filePart.data, { contentType: mimeType, upsert: false })
      if (uploadErr) {
        consola.error('BD note storage upload failed', uploadErr)
        throw createError({ statusCode: 500, statusMessage: 'Failed to store the file.' })
      }
      attachment = {
        attachmentStorageKey: storageKey,
        attachmentFileName: originalName,
        attachmentMimeType: mimeType,
        attachmentFileSize: filePart.data.length,
      }
    }

    const [note] = await db
      .insert(proposalBdNotes)
      .values({
        proposalId: id,
        organizationId: ctx.organizationId,
        kind: payload.kind,
        body: payload.body,
        createdByUserId: ctx.userId,
        ...attachment,
      })
      .returning()

    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:bd_note',
      details: { kind: payload.kind, hasAttachment: !!attachment },
    })

    return { success: true, note }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error logging BD note', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
