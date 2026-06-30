import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { strategyKpis } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ST-01 — remove a KPI. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    await useDrizzle()
      .delete(strategyKpis)
      .where(and(eq(strategyKpis.id, id), eq(strategyKpis.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting KPI', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
