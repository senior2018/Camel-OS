import { consola } from 'consola'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { opportunities, opportunityAttachments } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { OPPORTUNITY_ATTACHMENTS_BUCKET, useSupabaseStorage } from '@@/server/utils/storage'

const MAX_FILE_BYTES = 25 * 1024 * 1024 // 25 MB per OM-10.

// Allowed MIME types per OM-10 acceptance — PDF, Word, Excel. We accept both
// legacy (.doc/.xls) and modern (.docx/.xlsx) variants. Extend cautiously: every
// new format here is one more thing the storage virus-scanner has to handle.
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
])

/**
 * Server-mediated upload: client sends a multipart form, server validates,
 * pushes to Supabase Storage, then writes the DB row. This keeps the
 * service-role key off the browser and lets us enforce size / permission /
 * org-scope in one place.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const opportunityId = getRouterParam(event, 'id')
    if (!opportunityId) {
      throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })
    }

    const db = useDrizzle()

    const [opp] = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, opportunityId),
          eq(opportunities.organizationId, ctx.organizationId)
        )
      )
      .limit(1)

    if (!opp) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    const form = await readMultipartFormData(event)
    const filePart = form?.find((p) => p.name === 'file' && p.filename)

    if (!filePart || !filePart.data) {
      throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
    }

    if (filePart.data.length > MAX_FILE_BYTES) {
      throw createError({
        statusCode: 413,
        statusMessage: `File exceeds the ${MAX_FILE_BYTES / 1024 / 1024} MB limit`,
      })
    }

    const originalName = (filePart.filename ?? 'upload').slice(0, 255)
    const mimeType = filePart.type ?? 'application/octet-stream'

    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw createError({
        statusCode: 415,
        statusMessage: 'Only PDF, Word, and Excel files are supported.',
      })
    }

    // Storage key: <org>/<opp>/<uuid>-<original>. Scoping by org+opp keeps the
    // bucket listing tidy and makes manual recovery easier.
    const safeName = originalName.replace(/[^\w.-]/g, '_')
    const storagePath = `${ctx.organizationId}/${opportunityId}/${randomUUID()}-${safeName}`

    const { error: uploadErr } = await useSupabaseStorage()
      .storage.from(OPPORTUNITY_ATTACHMENTS_BUCKET)
      .upload(storagePath, filePart.data, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadErr) {
      consola.error('Storage upload failed', uploadErr)
      throw createError({
        statusCode: 500,
        statusMessage: 'Failed to store the file. Please try again.',
      })
    }

    const [created] = await db
      .insert(opportunityAttachments)
      .values({
        opportunityId,
        organizationId: ctx.organizationId,
        fileName: originalName,
        mimeType,
        sizeBytes: filePart.data.length,
        storagePath,
        uploadedByUserId: ctx.userId,
      })
      .returning()

    if (!created) throw new Error('Failed to record attachment')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'attachment_uploaded',
      resourceId: opportunityId,
      meta: { fileName: originalName, sizeBytes: filePart.data.length, attachmentId: created.id },
    })

    return { success: true, attachment: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error uploading attachment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
