import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { departmentalGoals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { goalUpdateSchema } from '@@/shared/schemas/strategy'

/** ST-02/03 — edit a departmental goal / update its progress + status. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, goalUpdateSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: departmentalGoals.id })
      .from(departmentalGoals)
      .where(
        and(eq(departmentalGoals.id, id), eq(departmentalGoals.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Goal not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description ?? null
    if (body.department !== undefined) updates.department = body.department ?? null
    if (body.ownerUserId !== undefined) updates.ownerUserId = body.ownerUserId ?? null
    if (body.objectiveId !== undefined) updates.objectiveId = body.objectiveId ?? null
    if (body.progressPct !== undefined) updates.progressPct = body.progressPct
    if (body.status !== undefined) updates.status = body.status
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ?? null

    const [updated] = await db
      .update(departmentalGoals)
      .set(updates)
      .where(eq(departmentalGoals.id, id))
      .returning()
    return { success: true, goal: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating goal', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
