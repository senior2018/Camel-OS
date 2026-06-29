import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectMilestones } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { milestoneSchema } from '@@/shared/schemas/project'

/** PJ-03 — update a milestone (status auto-stamps completion). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const mid = getRouterParam(event, 'mid')
    if (!mid) throw createError({ statusCode: 400, statusMessage: 'Milestone ID is required' })
    const data = await readValidatedBody(event, milestoneSchema.partial().parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: projectMilestones.id, status: projectMilestones.status })
      .from(projectMilestones)
      .where(
        and(eq(projectMilestones.id, mid), eq(projectMilestones.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Milestone not found' })

    const updates: Record<string, unknown> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.dueDate !== undefined) updates.dueDate = data.dueDate ?? null
    if (data.completionCriteria !== undefined)
      updates.completionCriteria = data.completionCriteria ?? null
    if (data.orderIndex !== undefined) updates.orderIndex = data.orderIndex
    if (data.status !== undefined) {
      updates.status = data.status
      updates.completedAt = data.status === 'completed' ? new Date() : null
    }

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
