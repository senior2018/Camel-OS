import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectMilestones } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PJ-03 — delete a milestone. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const mid = getRouterParam(event, 'mid')
    if (!mid) throw createError({ statusCode: 400, statusMessage: 'Milestone ID is required' })
    await useDrizzle()
      .delete(projectMilestones)
      .where(
        and(eq(projectMilestones.id, mid), eq(projectMilestones.organizationId, ctx.organizationId))
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting milestone', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
