import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunityStageActivities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Remove an activity item from this opportunity. Per-opp only — does not touch
 * the org-wide defaults. The user might want to drop an item that doesn't
 * apply (e.g. "Decide consortium vs solo" on an obviously-solo bid).
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const oppId = getRouterParam(event, 'id')
    const activityId = getRouterParam(event, 'activityId')
    if (!oppId || !activityId) {
      throw createError({ statusCode: 400, statusMessage: 'Ids required' })
    }

    const [deleted] = await useDrizzle()
      .delete(opportunityStageActivities)
      .where(
        and(
          eq(opportunityStageActivities.id, activityId),
          eq(opportunityStageActivities.opportunityId, oppId),
          eq(opportunityStageActivities.organizationId, ctx.organizationId)
        )
      )
      .returning({ id: opportunityStageActivities.id, label: opportunityStageActivities.label })

    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Activity not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'activity_removed',
      resourceId: oppId,
      meta: { activityId: deleted.id, label: deleted.label },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
