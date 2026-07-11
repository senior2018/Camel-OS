import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { strategicObjectives } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ST-01 — delete an objective (cascades KPIs + check-ins; unlinks goals). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    await useDrizzle()
      .delete(strategicObjectives)
      .where(
        and(
          eq(strategicObjectives.id, id),
          eq(strategicObjectives.organizationId, ctx.organizationId)
        )
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting objective', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
