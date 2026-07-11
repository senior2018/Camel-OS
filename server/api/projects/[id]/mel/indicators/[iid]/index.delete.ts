import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { melIndicators } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ME-01 — delete an indicator (cascades its data points). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'update')
    const iid = getRouterParam(event, 'iid')
    if (!iid) throw createError({ statusCode: 400, statusMessage: 'Indicator ID is required' })
    await useDrizzle()
      .delete(melIndicators)
      .where(and(eq(melIndicators.id, iid), eq(melIndicators.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting indicator', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
