import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { knowledgeArticles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateKnowledgeSchema } from '@@/shared/schemas/knowledge'

/** KM-01/03/06 — edit content, taxonomy, access, and publish state. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const b = await readValidatedBody(event, updateKnowledgeSchema.parse)
    const db = useDrizzle()
    const [existing] = await db
      .select({ status: knowledgeArticles.status, publishedAt: knowledgeArticles.publishedAt })
      .from(knowledgeArticles)
      .where(
        and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Not found' })

    const set: Record<string, unknown> = { updatedAt: new Date() }
    for (const k of [
      'title',
      'excerpt',
      'body',
      'videoUrl',
      'category',
      'tags',
      'contextKeys',
      'visibility',
      'allowedRoleIds',
      'status',
    ] as const) {
      if (b[k] !== undefined) set[k] = b[k]
    }
    if (b.status === 'published' && existing.status !== 'published' && !existing.publishedAt)
      set.publishedAt = new Date()
    await db.update(knowledgeArticles).set(set).where(eq(knowledgeArticles.id, id))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating article', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
