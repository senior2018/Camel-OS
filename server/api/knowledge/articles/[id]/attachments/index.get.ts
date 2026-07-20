import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { knowledgeAttachments } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  KNOWLEDGE_DOCS_BUCKET,
  SIGNED_URL_TTL_SECONDS,
  useSupabaseStorage,
} from '@@/server/utils/storage'

/** KM-01 — list a knowledge item's documents with short-lived download URLs. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Article id is required' })

    const rows = await useDrizzle()
      .select()
      .from(knowledgeAttachments)
      .where(
        and(
          eq(knowledgeAttachments.articleId, id),
          eq(knowledgeAttachments.organizationId, ctx.organizationId)
        )
      )
      .orderBy(desc(knowledgeAttachments.createdAt))

    const storage = rows.length ? useSupabaseStorage() : null
    const items = await Promise.all(
      rows.map(async (r) => {
        let url: string | null = null
        if (storage) {
          const { data } = await storage.storage
            .from(KNOWLEDGE_DOCS_BUCKET)
            .createSignedUrl(r.storagePath, SIGNED_URL_TTL_SECONDS)
          url = data?.signedUrl ?? null
        }
        return {
          id: r.id,
          fileName: r.fileName,
          mimeType: r.mimeType,
          sizeBytes: r.sizeBytes,
          url,
        }
      })
    )
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing knowledge documents', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
