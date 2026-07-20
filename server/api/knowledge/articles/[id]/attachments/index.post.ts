import { consola } from 'consola'
import { randomUUID } from 'node:crypto'
import { and, eq } from 'drizzle-orm'

import { knowledgeArticles, knowledgeAttachments } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { KNOWLEDGE_DOCS_BUCKET, useSupabaseStorage } from '@@/server/utils/storage'

const MAX_FILE_BYTES = 25 * 1024 * 1024
const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
])

/** KM-01 — upload a document onto a knowledge item (server-mediated). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Article id is required' })
    const db = useDrizzle()

    const [article] = await db
      .select({ id: knowledgeArticles.id })
      .from(knowledgeArticles)
      .where(
        and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!article) throw createError({ statusCode: 404, statusMessage: 'Article not found' })

    const form = await readMultipartFormData(event)
    const filePart = form?.find((p) => p.name === 'file' && p.filename)
    if (!filePart?.data) throw createError({ statusCode: 400, statusMessage: 'No file uploaded' })
    if (filePart.data.length > MAX_FILE_BYTES) {
      throw createError({ statusCode: 413, statusMessage: 'File exceeds the 25 MB limit' })
    }
    const mimeType = filePart.type ?? 'application/octet-stream'
    if (!ALLOWED_MIME_TYPES.has(mimeType)) {
      throw createError({
        statusCode: 415,
        statusMessage: 'Only PDF, Word, Excel, and PowerPoint files are supported.',
      })
    }

    const originalName = (filePart.filename ?? 'upload').slice(0, 255)
    const safeName = originalName.replace(/[^\w.-]/g, '_')
    const storagePath = `${ctx.organizationId}/${id}/${randomUUID()}-${safeName}`

    const { error: uploadErr } = await useSupabaseStorage()
      .storage.from(KNOWLEDGE_DOCS_BUCKET)
      .upload(storagePath, filePart.data, { contentType: mimeType, upsert: false })
    if (uploadErr) {
      consola.error('Storage upload failed', uploadErr)
      throw createError({ statusCode: 500, statusMessage: 'Failed to store the file.' })
    }

    const [created] = await db
      .insert(knowledgeAttachments)
      .values({
        articleId: id,
        organizationId: ctx.organizationId,
        fileName: originalName,
        mimeType,
        sizeBytes: filePart.data.length,
        storagePath,
        uploadedByUserId: ctx.userId,
      })
      .returning({ id: knowledgeAttachments.id })
    return { success: true, id: created?.id }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error uploading knowledge document', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
