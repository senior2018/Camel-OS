import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectActivities, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  canManageProjectTeam,
  isProjectMember,
  resolveOrgProjectSettings,
} from '@@/server/utils/project-settings'
import { recomputeProjectRollups } from '@@/server/utils/project-rollup'
import { createActivitySchema } from '@@/shared/schemas/project'

/** PJ-04 — add an activity. Project members may create activities (P21). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, createActivitySchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({
        id: projects.id,
        projectManagerUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
        closedAt: projects.closedAt,
      })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
    if (project.closedAt)
      throw createError({ statusCode: 409, statusMessage: 'Project is closed.' })

    const lead = await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, project)
    if (!lead && !(await isProjectMember(ctx.userId, id))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only project members can add activities.',
      })
    }

    // A new activity starts at the first "not started" configured status.
    const settings = await resolveOrgProjectSettings(ctx.organizationId)
    const start =
      settings.activityStatuses.find((s) => s.category === 'not_started') ??
      settings.activityStatuses[0]!

    const [created] = await db
      .insert(projectActivities)
      .values({
        projectId: id,
        organizationId: ctx.organizationId,
        milestoneId: body.milestoneId ?? null,
        name: body.name,
        description: body.description ?? null,
        // P21 — the creator is auto-assigned unless they picked someone else.
        assignedUserId: body.assignedUserId ?? ctx.userId,
        startDate: body.startDate ?? null,
        endDate: body.endDate ?? null,
        plannedHours: body.plannedHours != null ? String(body.plannedHours) : null,
        percentComplete: 0,
        statusLabel: start.label,
        statusCategory: start.category,
        dependsOnActivityId: body.dependsOnActivityId ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    await recomputeProjectRollups(id)
    return { success: true, activity: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
