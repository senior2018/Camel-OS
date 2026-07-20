import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { knowledgeArticles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** KM-01 — delete an article. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'delete')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    await useDrizzle()
      .delete(knowledgeArticles)
      .where(
        and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.organizationId, ctx.organizationId))
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting article', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
