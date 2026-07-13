import { consola } from 'consola'
import { aliasedTable, and, asc, eq } from 'drizzle-orm'

import {
  projectActivities,
  projectActivityComments,
  projectMilestones,
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

/** P16 — one activity's detail + its comment thread. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    const aid = getRouterParam(event, 'aid')
    if (!id || !aid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const db = useDrizzle()

    const assignee = aliasedTable(users, 'assignee')
    const creator = aliasedTable(users, 'creator')
    const [row] = await db
      .select({
        activity: projectActivities,
        milestoneName: projectMilestones.name,
        assigneeFirstName: assignee.firstName,
        assigneeLastName: assignee.lastName,
        creatorFirstName: creator.firstName,
        creatorLastName: creator.lastName,
        pmUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
      })
      .from(projectActivities)
      .leftJoin(projectMilestones, eq(projectMilestones.id, projectActivities.milestoneId))
      .leftJoin(assignee, eq(assignee.id, projectActivities.assignedUserId))
      .innerJoin(projects, eq(projects.id, projectActivities.projectId))
      .leftJoin(creator, eq(creator.id, projectActivities.createdByUserId))
      .where(
        and(
          eq(projectActivities.id, aid),
          eq(projectActivities.projectId, id),
          eq(projectActivities.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Activity not found' })

    // Need-to-know: only members / leads / oversight may view.
    const project = {
      projectManagerUserId: row.pmUserId,
      createdByUserId: row.createdByUserId,
    }
    const isLead = await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, project)
    const member = isLead || (await isProjectMember(ctx.userId, id))
    if (!member && !(await canOverseeProjects(ctx.userId, ctx.isSystemAdmin))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You do not have access to this project.',
      })
    }

    const commentRows = await db
      .select({
        id: projectActivityComments.id,
        body: projectActivityComments.body,
        userId: projectActivityComments.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        createdAt: projectActivityComments.createdAt,
      })
      .from(projectActivityComments)
      .leftJoin(users, eq(users.id, projectActivityComments.userId))
      .where(eq(projectActivityComments.activityId, aid))
      .orderBy(asc(projectActivityComments.createdAt))

    return {
      activity: {
        ...row.activity,
        milestoneName: row.milestoneName,
        assigneeName:
          [row.assigneeFirstName, row.assigneeLastName].filter(Boolean).join(' ') || null,
        creatorName: [row.creatorFirstName, row.creatorLastName].filter(Boolean).join(' ') || null,
      },
      comments: commentRows,
      permissions: {
        isLead,
        isAssignee: row.activity.assignedUserId === ctx.userId,
        canComment: member,
        canEditStatus: isLead || row.activity.assignedUserId === ctx.userId,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
