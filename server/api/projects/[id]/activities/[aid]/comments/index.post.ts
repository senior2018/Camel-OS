import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectActivities, projectActivityComments, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam, isProjectMember } from '@@/server/utils/project-settings'
import { createNotifications } from '@@/server/utils/notifications'
import { activityCommentSchema } from '@@/shared/schemas/project'

/** P16 — add a comment / progress note on an activity. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    const aid = getRouterParam(event, 'aid')
    if (!id || !aid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const body = await readValidatedBody(event, activityCommentSchema.parse)
    const db = useDrizzle()

    const [row] = await db
      .select({
        activityId: projectActivities.id,
        activityName: projectActivities.name,
        assignedUserId: projectActivities.assignedUserId,
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
    if (!isLead && !(await isProjectMember(ctx.userId, id))) {
      throw createError({ statusCode: 403, statusMessage: 'Only project members can comment.' })
    }

    const [created] = await db
      .insert(projectActivityComments)
      .values({
        activityId: aid,
        projectId: id,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        body: body.body,
      })
      .returning()

    // Notify the other party (assignee ↔ PM) that there's a new comment.
    const notify = new Set<string>()
    if (row.assignedUserId && row.assignedUserId !== ctx.userId) notify.add(row.assignedUserId)
    if (row.pmUserId && row.pmUserId !== ctx.userId) notify.add(row.pmUserId)
    if (notify.size) {
      await createNotifications(
        [...notify].map((userId) => ({
          organizationId: ctx.organizationId,
          userId,
          type: 'project_activity_comment',
          title: `New comment on "${row.activityName}"`,
          body: body.body.slice(0, 140),
          linkUrl: `/projects/${id}/activities/${aid}`,
        }))
      )
    }

    return { success: true, comment: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding activity comment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
