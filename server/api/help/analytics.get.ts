import { consola } from 'consola'
import { and, desc, eq, sql } from 'drizzle-orm'
import { knowledgeArticles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HD-05/KM-05 — knowledge analytics: totals + most-viewed / most-helpful. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'update')
    const db = useDrizzle()
    const pub = and(
      eq(knowledgeArticles.organizationId, ctx.organizationId),
      eq(knowledgeArticles.status, 'published')
    )
    const [totals] = await db
      .select({
        articles: sql<number>`count(*) filter (where ${knowledgeArticles.kind} = 'article')::int`,
        help: sql<number>`count(*) filter (where ${knowledgeArticles.kind} = 'help')::int`,
        views: sql<number>`coalesce(sum(${knowledgeArticles.viewCount}),0)::int`,
        helpful: sql<number>`coalesce(sum(${knowledgeArticles.helpfulCount}),0)::int`,
      })
      .from(knowledgeArticles)
      .where(pub)
    const topViewed = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        viewCount: knowledgeArticles.viewCount,
        helpfulCount: knowledgeArticles.helpfulCount,
      })
      .from(knowledgeArticles)
      .where(pub)
      .orderBy(desc(knowledgeArticles.viewCount))
      .limit(5)
    const topHelpful = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        helpfulCount: knowledgeArticles.helpfulCount,
        notHelpfulCount: knowledgeArticles.notHelpfulCount,
      })
      .from(knowledgeArticles)
      .where(pub)
      .orderBy(desc(knowledgeArticles.helpfulCount))
      .limit(5)
    return { totals, topViewed, topHelpful }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building help analytics', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
