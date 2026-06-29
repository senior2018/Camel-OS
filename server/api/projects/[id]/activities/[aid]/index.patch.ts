import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectActivities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { activitySchema } from '@@/shared/schemas/project'

/** PJ-04 — update an activity (assignment, dates, % complete, status). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const aid = getRouterParam(event, 'aid')
    if (!aid) throw createError({ statusCode: 400, statusMessage: 'Activity ID is required' })
    const data = await readValidatedBody(event, activitySchema.partial().parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: projectActivities.id })
      .from(projectActivities)
      .where(
        and(eq(projectActivities.id, aid), eq(projectActivities.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Activity not found' })

    const updates: Record<string, unknown> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.milestoneId !== undefined) updates.milestoneId = data.milestoneId ?? null
    if (data.assignedUserId !== undefined) updates.assignedUserId = data.assignedUserId ?? null
    if (data.startDate !== undefined) updates.startDate = data.startDate ?? null
    if (data.endDate !== undefined) updates.endDate = data.endDate ?? null
    if (data.plannedHours !== undefined)
      updates.plannedHours = data.plannedHours != null ? String(data.plannedHours) : null
    if (data.percentComplete !== undefined) updates.percentComplete = data.percentComplete
    if (data.status !== undefined) {
      updates.status = data.status
      if (data.status === 'done' && data.percentComplete === undefined)
        updates.percentComplete = 100
    }
    if (data.dependsOnActivityId !== undefined)
      updates.dependsOnActivityId = data.dependsOnActivityId ?? null

    const [updated] = await db
      .update(projectActivities)
      .set(updates)
      .where(eq(projectActivities.id, aid))
      .returning()
    return { success: true, activity: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
