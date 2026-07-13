import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectMilestones, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam } from '@@/server/utils/project-settings'
import { recomputeProjectRollups } from '@@/server/utils/project-rollup'

/** PJ-03 — delete a milestone (PM/lead only, P21); its activities become
 * unscheduled, so re-roll the project afterwards. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    const mid = getRouterParam(event, 'mid')
    if (!id || !mid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
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

    await db
      .delete(projectMilestones)
      .where(
        and(eq(projectMilestones.id, mid), eq(projectMilestones.organizationId, ctx.organizationId))
      )

    await recomputeProjectRollups(id)
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting milestone', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
