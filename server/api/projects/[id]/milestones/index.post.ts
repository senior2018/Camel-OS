import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectMilestones, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { milestoneSchema } from '@@/shared/schemas/project'

/** PJ-03 — add a milestone. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, milestoneSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [created] = await db
      .insert(projectMilestones)
      .values({
        projectId: id,
        organizationId: ctx.organizationId,
        name: body.name,
        dueDate: body.dueDate ?? null,
        completionCriteria: body.completionCriteria ?? null,
        status: body.status,
        orderIndex: body.orderIndex,
        completedAt: body.status === 'completed' ? new Date() : null,
      })
      .returning()
    return { success: true, milestone: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating milestone', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
