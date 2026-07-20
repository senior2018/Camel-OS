import { consola } from 'consola'
import { and, desc, eq, sql } from 'drizzle-orm'
import { knowledgeArticles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HD-02 — published help docs relevant to the current route/module context. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'read')
    const context = (getQuery(event).context as string) || ''
    const db = useDrizzle()
    const items = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        excerpt: knowledgeArticles.excerpt,
      })
      .from(knowledgeArticles)
      .where(
        and(
          eq(knowledgeArticles.organizationId, ctx.organizationId),
          eq(knowledgeArticles.kind, 'help'),
          eq(knowledgeArticles.status, 'published'),
          context ? sql`${knowledgeArticles.contextKeys} ? ${context}` : sql`true`
        )
      )
      .orderBy(desc(knowledgeArticles.helpfulCount))
      .limit(8)
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading contextual help', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
