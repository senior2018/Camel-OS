import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectActivities, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { activitySchema } from '@@/shared/schemas/project'

/** PJ-04 — add an activity under a milestone. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, activitySchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [created] = await db
      .insert(projectActivities)
      .values({
        projectId: id,
        organizationId: ctx.organizationId,
        milestoneId: body.milestoneId ?? null,
        name: body.name,
        assignedUserId: body.assignedUserId ?? null,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        plannedHours: body.plannedHours != null ? String(body.plannedHours) : null,
        percentComplete: body.percentComplete,
        status: body.status,
        dependsOnActivityId: body.dependsOnActivityId ?? null,
      })
      .returning()
    return { success: true, activity: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
