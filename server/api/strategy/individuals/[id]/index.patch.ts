import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { individualObjectives } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission, requireUser } from '@@/server/utils/permission-guard'
import { individualObjectiveUpdateSchema } from '@@/shared/schemas/strategy'

/** ST-05 — update an individual objective. Owner can update their own progress. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, individualObjectiveUpdateSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: individualObjectives.id, userId: individualObjectives.userId })
      .from(individualObjectives)
      .where(
        and(
          eq(individualObjectives.id, id),
          eq(individualObjectives.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Objective not found' })
    if (existing.userId !== ctx.userId) await requirePermission(event, 'strategy', 'update')

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description ?? null
    if (body.progressPct !== undefined) updates.progressPct = body.progressPct
    if (body.status !== undefined) updates.status = body.status
    if (body.dueDate !== undefined) updates.dueDate = body.dueDate ?? null

    const [updated] = await db
      .update(individualObjectives)
      .set(updates)
      .where(eq(individualObjectives.id, id))
      .returning()
    return { success: true, objective: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating individual objective', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
