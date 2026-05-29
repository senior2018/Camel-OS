import { consola } from 'consola'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { opportunityStageActivities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Toggle an activity's completed state. `completed=true` stamps now + the
 * caller as `completed_by_user_id`; `completed=false` clears both.
 */
const schema = z.object({
  completed: z.boolean(),
})

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const oppId = getRouterParam(event, 'id')
    const activityId = getRouterParam(event, 'activityId')
    if (!oppId || !activityId) {
      throw createError({ statusCode: 400, statusMessage: 'Ids required' })
    }

    const parsed = schema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid payload' })
    }

    const now = new Date()
    const [updated] = await useDrizzle()
      .update(opportunityStageActivities)
      .set({
        completedAt: parsed.data.completed ? now : null,
        completedByUserId: parsed.data.completed ? ctx.userId : null,
        updatedAt: now,
      })
      .where(
        and(
          eq(opportunityStageActivities.id, activityId),
          eq(opportunityStageActivities.opportunityId, oppId),
          eq(opportunityStageActivities.organizationId, ctx.organizationId)
        )
      )
      .returning()

    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Activity not found' })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: parsed.data.completed ? 'activity_completed' : 'activity_uncompleted',
      resourceId: oppId,
      meta: { activityId, label: updated.label, stage: updated.stage },
    })

    return { success: true, activity: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error toggling activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
