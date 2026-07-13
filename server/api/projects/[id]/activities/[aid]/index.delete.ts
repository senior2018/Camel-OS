import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectActivities, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam, isProjectMember } from '@@/server/utils/project-settings'
import { recomputeProjectRollups } from '@@/server/utils/project-rollup'

/** PJ-04 — delete an activity (project members, P21), then re-roll statuses. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    const aid = getRouterParam(event, 'aid')
    if (!id || !aid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
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
        statusMessage: 'Only project members can delete activities.',
      })
    }

    await db
      .delete(projectActivities)
      .where(
        and(eq(projectActivities.id, aid), eq(projectActivities.organizationId, ctx.organizationId))
      )

    await recomputeProjectRollups(id)
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
