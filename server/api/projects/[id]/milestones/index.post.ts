import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectMilestones, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam } from '@@/server/utils/project-settings'
import { recomputeProjectRollups } from '@@/server/utils/project-rollup'
import { milestoneSchema } from '@@/shared/schemas/project'

/** PJ-03 — add a milestone. Milestones are managed by the PM/lead only (P21). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, milestoneSchema.parse)
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
    if (!(await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, project))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the project manager can manage milestones.',
      })
    }

    const [created] = await db
      .insert(projectMilestones)
      .values({
        projectId: id,
        organizationId: ctx.organizationId,
        name: body.name,
        dueDate: body.dueDate ?? null,
        completionCriteria: body.completionCriteria ?? null,
        // Derived — a fresh milestone has no activities, so it's "not started".
        status: 'not_started',
        statusCategory: 'not_started',
        orderIndex: body.orderIndex,
      })
      .returning()

    await recomputeProjectRollups(id)
    return { success: true, milestone: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating milestone', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
