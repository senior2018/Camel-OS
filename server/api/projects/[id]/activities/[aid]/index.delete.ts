import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectActivities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PJ-04 — delete an activity. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const aid = getRouterParam(event, 'aid')
    if (!aid) throw createError({ statusCode: 400, statusMessage: 'Activity ID is required' })
    await useDrizzle()
      .delete(projectActivities)
      .where(
        and(eq(projectActivities.id, aid), eq(projectActivities.organizationId, ctx.organizationId))
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
