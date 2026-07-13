import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import {
  projectActivities,
  projectActivityComments,
  projects,
  users,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  canManageProjectTeam,
  canOverseeProjects,
  isProjectMember,
} from '@@/server/utils/project-settings'

/** P16 — an activity's comment thread (for the conversation component). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    const aid = getRouterParam(event, 'aid')
    if (!id || !aid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const db = useDrizzle()

    const [row] = await db
      .select({
        pmUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
      })
      .from(projectActivities)
      .innerJoin(projects, eq(projects.id, projectActivities.projectId))
      .where(
        and(
          eq(projectActivities.id, aid),
          eq(projectActivities.projectId, id),
          eq(projectActivities.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Activity not found' })

    const isLead = await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, {
      projectManagerUserId: row.pmUserId,
      createdByUserId: row.createdByUserId,
    })
    if (
      !isLead &&
      !(await isProjectMember(ctx.userId, id)) &&
      !(await canOverseeProjects(ctx.userId, ctx.isSystemAdmin))
    ) {
      throw createError({ statusCode: 403, statusMessage: 'No access to this project.' })
    }

    const comments = await db
      .select({
        id: projectActivityComments.id,
        body: projectActivityComments.body,
        authorUserId: projectActivityComments.userId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        createdAt: projectActivityComments.createdAt,
      })
      .from(projectActivityComments)
      .leftJoin(users, eq(users.id, projectActivityComments.userId))
      .where(eq(projectActivityComments.activityId, aid))
      .orderBy(asc(projectActivityComments.createdAt))

    return { comments }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading activity comments', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
