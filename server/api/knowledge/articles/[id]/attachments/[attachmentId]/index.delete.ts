import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { knowledgeAttachments } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { KNOWLEDGE_DOCS_BUCKET, useSupabaseStorage } from '@@/server/utils/storage'

/** KM-01 — delete a knowledge document (storage object + DB row). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'update')
    const attachmentId = getRouterParam(event, 'attachmentId')
    if (!attachmentId)
      throw createError({ statusCode: 400, statusMessage: 'Attachment id required' })
    const db = useDrizzle()

    const [row] = await db
      .select({ id: knowledgeAttachments.id, storagePath: knowledgeAttachments.storagePath })
      .from(knowledgeAttachments)
      .where(
        and(
          eq(knowledgeAttachments.id, attachmentId),
          eq(knowledgeAttachments.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Attachment not found' })

    await useSupabaseStorage().storage.from(KNOWLEDGE_DOCS_BUCKET).remove([row.storagePath])
    await db.delete(knowledgeAttachments).where(eq(knowledgeAttachments.id, attachmentId))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting knowledge document', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
