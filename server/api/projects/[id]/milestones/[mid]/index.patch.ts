import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectMilestones, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam } from '@@/server/utils/project-settings'
import { milestoneSchema } from '@@/shared/schemas/project'

/**
 * PJ-03 — update a milestone's details (PM/lead only, P21). Milestone STATUS is
 * derived from its activities and can never be set here (P14).
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    const mid = getRouterParam(event, 'mid')
    if (!id || !mid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const data = await readValidatedBody(event, milestoneSchema.partial().parse)
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

    const [existing] = await db
      .select({ id: projectMilestones.id })
      .from(projectMilestones)
      .where(
        and(
          eq(projectMilestones.id, mid),
          eq(projectMilestones.projectId, id),
          eq(projectMilestones.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Milestone not found' })

    const updates: Record<string, unknown> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.dueDate !== undefined) updates.dueDate = data.dueDate ?? null
    if (data.completionCriteria !== undefined)
      updates.completionCriteria = data.completionCriteria ?? null
    if (data.orderIndex !== undefined) updates.orderIndex = data.orderIndex

    const [updated] = await db
      .update(projectMilestones)
      .set(updates)
      .where(eq(projectMilestones.id, mid))
      .returning()
    return { success: true, milestone: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating milestone', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
