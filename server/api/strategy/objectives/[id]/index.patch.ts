import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { strategicObjectives } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { objectiveUpdateSchema } from '@@/shared/schemas/strategy'

/** ST-01 — edit an objective or set its manual RAG status. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, objectiveUpdateSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: strategicObjectives.id })
      .from(strategicObjectives)
      .where(
        and(
          eq(strategicObjectives.id, id),
          eq(strategicObjectives.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Objective not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.year !== undefined) updates.year = body.year
    if (body.title !== undefined) updates.title = body.title
    if (body.description !== undefined) updates.description = body.description ?? null
    if (body.theme !== undefined) updates.theme = body.theme ?? null
    if (body.ownerUserId !== undefined) updates.ownerUserId = body.ownerUserId ?? null
    if (body.manualStatus !== undefined) updates.manualStatus = body.manualStatus ?? null

    const [updated] = await db
      .update(strategicObjectives)
      .set(updates)
      .where(eq(strategicObjectives.id, id))
      .returning()
    return { success: true, objective: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating objective', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
