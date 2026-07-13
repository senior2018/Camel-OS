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
import { createNotifications } from '@@/server/utils/notifications'
import { updateActivitySchema } from '@@/shared/schemas/project'

/**
 * PJ-04 — update an activity. Field edits are open to project members; changing
 * the STATUS is restricted to the assignee or the PM, and re-assigning the
 * activity is restricted to the PM/lead (P21).
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    const aid = getRouterParam(event, 'aid')
    if (!id || !aid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const data = await readValidatedBody(event, updateActivitySchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({
        id: projectActivities.id,
        name: projectActivities.name,
        assignedUserId: projectActivities.assignedUserId,
        statusCategory: projectActivities.statusCategory,
      })
      .from(projectActivities)
      .where(
        and(eq(projectActivities.id, aid), eq(projectActivities.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Activity not found' })

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

    const isLead = await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, project)
    const isAssignee = existing.assignedUserId === ctx.userId
    if (!isLead && !(await isProjectMember(ctx.userId, id))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only project members can edit activities.',
      })
    }

    const updates: Record<string, unknown> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.description !== undefined) updates.description = data.description ?? null
    if (data.milestoneId !== undefined) updates.milestoneId = data.milestoneId ?? null
    if (data.startDate !== undefined) updates.startDate = data.startDate ?? null
    if (data.endDate !== undefined) updates.endDate = data.endDate ?? null
    if (data.plannedHours !== undefined)
      updates.plannedHours = data.plannedHours != null ? String(data.plannedHours) : null
    if (data.percentComplete !== undefined) updates.percentComplete = data.percentComplete
    if (data.dependsOnActivityId !== undefined)
      updates.dependsOnActivityId = data.dependsOnActivityId ?? null

    // P21 — re-assignment is a PM/lead action.
    let reassignedTo: string | null = null
    if (data.assignedUserId !== undefined) {
      const next = data.assignedUserId ?? null
      if (next !== existing.assignedUserId) {
        if (!isLead)
          throw createError({
            statusCode: 403,
            statusMessage: 'Only the project manager can re-assign an activity.',
          })
        updates.assignedUserId = next
        reassignedTo = next
      }
    }

    // P14/P21 — status change: only the assignee or the PM/lead. The label must
    // be a configured status; its category drives milestone/project rollup.
    let statusChanged = false
    if (data.statusLabel !== undefined) {
      if (!isLead && !isAssignee)
        throw createError({
          statusCode: 403,
          statusMessage: 'Only the assignee or the project manager can change this status.',
        })
      const settings = await resolveOrgProjectSettings(ctx.organizationId)
      const opt = settings.activityStatuses.find(
        (s) => s.label.toLowerCase() === data.statusLabel!.toLowerCase()
      )
      if (!opt) throw createError({ statusCode: 400, statusMessage: 'Unknown activity status.' })
      updates.statusLabel = opt.label
      updates.statusCategory = opt.category
      statusChanged = opt.category !== existing.statusCategory
      // Keep percentComplete coherent with the category unless set explicitly.
      if (data.percentComplete === undefined) {
        if (opt.category === 'done') updates.percentComplete = 100
        else if (opt.category === 'not_started') updates.percentComplete = 0
      }
    }

    const [updated] = await db
      .update(projectActivities)
      .set(updates)
      .where(eq(projectActivities.id, aid))
      .returning()

    // Recompute milestone/project rollups when a status actually moved category.
    if (statusChanged) await recomputeProjectRollups(id)

    // Notify a newly-assigned member.
    if (reassignedTo && reassignedTo !== ctx.userId) {
      await createNotifications([
        {
          organizationId: ctx.organizationId,
          userId: reassignedTo,
          type: 'project_activity_assigned',
          title: `Assigned: "${existing.name}"`,
          body: 'You have been assigned an activity.',
          linkUrl: `/projects/${id}/activities/${aid}`,
        },
      ])
    }

    return { success: true, activity: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
