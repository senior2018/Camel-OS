import { consola } from 'consola'
import { knowledgeArticles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createKnowledgeSchema } from '@@/shared/schemas/knowledge'

/** KM-01 — start a new knowledge article / help doc. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'create')
    const b = await readValidatedBody(event, createKnowledgeSchema.parse)
    const [created] = await useDrizzle()
      .insert(knowledgeArticles)
      .values({
        organizationId: ctx.organizationId,
        kind: b.kind,
        title: b.title,
        authorUserId: ctx.userId,
      })
      .returning({ id: knowledgeArticles.id })
    return { success: true, article: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating article', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
