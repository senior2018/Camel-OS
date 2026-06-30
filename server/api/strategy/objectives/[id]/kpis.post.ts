import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { strategicObjectives, strategyKpis } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { kpiSchema } from '@@/shared/schemas/strategy'

/** ST-01 — add a KPI to an objective. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, kpiSchema.parse)
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
      .insert(strategyKpis)
      .values({
        organizationId: ctx.organizationId,
        objectiveId: id,
        name: body.name,
        unit: body.unit ?? null,
        baseline: String(body.baseline),
        target: body.target != null ? String(body.target) : null,
        current: String(body.current),
        direction: body.direction,
      })
      .returning()
    return { success: true, kpi: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding KPI', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
