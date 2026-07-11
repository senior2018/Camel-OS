import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { individualObjectives } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ST-05 — remove an individual objective. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    await useDrizzle()
      .delete(individualObjectives)
      .where(
        and(
          eq(individualObjectives.id, id),
          eq(individualObjectives.organizationId, ctx.organizationId)
        )
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting individual objective', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
