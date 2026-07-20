import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { knowledgeCategories } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** KM-02 — delete a category. Children re-parent to null (become top-level). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const db = useDrizzle()
    await db
      .update(knowledgeCategories)
      .set({ parentId: null })
      .where(
        and(
          eq(knowledgeCategories.parentId, id),
          eq(knowledgeCategories.organizationId, ctx.organizationId)
        )
      )
    await db
      .delete(knowledgeCategories)
      .where(
        and(
          eq(knowledgeCategories.id, id),
          eq(knowledgeCategories.organizationId, ctx.organizationId)
        )
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting knowledge category', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
