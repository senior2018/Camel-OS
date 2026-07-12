import { consola } from 'consola'
import { and, eq, sql } from 'drizzle-orm'
import { knowledgeArticles, knowledgeFeedback } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { knowledgeFeedbackSchema } from '@@/shared/schemas/knowledge'

/** KM-05 — was this helpful? One vote per user; recomputes the counters. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const b = await readValidatedBody(event, knowledgeFeedbackSchema.parse)
    const db = useDrizzle()
    await db
      .insert(knowledgeFeedback)
      .values({
        articleId: id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        helpful: b.helpful,
        comment: b.comment ?? null,
      })
      .onConflictDoUpdate({
        target: [knowledgeFeedback.articleId, knowledgeFeedback.userId],
        set: { helpful: b.helpful, comment: b.comment ?? null },
      })
    const [agg] = await db
      .select({
        helpful: sql<number>`count(*) filter (where ${knowledgeFeedback.helpful})::int`,
        notHelpful: sql<number>`count(*) filter (where not ${knowledgeFeedback.helpful})::int`,
      })
      .from(knowledgeFeedback)
      .where(eq(knowledgeFeedback.articleId, id))
    await db
      .update(knowledgeArticles)
      .set({ helpfulCount: agg?.helpful ?? 0, notHelpfulCount: agg?.notHelpful ?? 0 })
      .where(
        and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.organizationId, ctx.organizationId))
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving feedback', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
