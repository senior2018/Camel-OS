import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { knowledgeCategories } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** KM-02 — the org's managed category taxonomy, each with its full path. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'read')
    const rows = await useDrizzle()
      .select()
      .from(knowledgeCategories)
      .where(eq(knowledgeCategories.organizationId, ctx.organizationId))
      .orderBy(asc(knowledgeCategories.orderIndex), asc(knowledgeCategories.name))

    const byId = new Map(rows.map((r) => [r.id, r]))
    const path = (id: string): string => {
      const parts: string[] = []
      let cur = byId.get(id)
      let guard = 0
      while (cur && guard++ < 10) {
        parts.unshift(cur.name)
        cur = cur.parentId ? byId.get(cur.parentId) : undefined
      }
      return parts.join(' › ')
    }
    const items = rows.map((r) => ({
      id: r.id,
      name: r.name,
      parentId: r.parentId,
      path: path(r.id),
    }))
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing knowledge categories', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
