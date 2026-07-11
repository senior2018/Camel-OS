import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { strategicObjectives, strategyCheckins } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { checkinSchema } from '@@/shared/schemas/strategy'

/** ST-03 — log a strategy review check-in against an objective. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, checkinSchema.parse)
    const db = useDrizzle()

    const [objective] = await db
      .select({ id: strategicObjectives.id })
      .from(strategicObjectives)
      .where(
        and(
          eq(strategicObjectives.id, id),
          eq(strategicObjectives.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!objective) throw createError({ statusCode: 404, statusMessage: 'Objective not found' })

    const [created] = await db
      .insert(strategyCheckins)
      .values({
        organizationId: ctx.organizationId,
        objectiveId: id,
        summary: body.summary ?? null,
        ragStatus: body.ragStatus,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, checkin: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding check-in', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
