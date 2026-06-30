import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { departmentalGoals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ST-02 — delete a departmental goal (cascades individual objectives). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    await useDrizzle()
      .delete(departmentalGoals)
      .where(
        and(eq(departmentalGoals.id, id), eq(departmentalGoals.organizationId, ctx.organizationId))
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting goal', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
