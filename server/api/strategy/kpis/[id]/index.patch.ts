import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { strategyKpis } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { kpiUpdateSchema } from '@@/shared/schemas/strategy'

/** ST-03 — update a KPI (typically its current value during a check-in). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, kpiUpdateSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: strategyKpis.id })
      .from(strategyKpis)
      .where(and(eq(strategyKpis.id, id), eq(strategyKpis.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'KPI not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (body.name !== undefined) updates.name = body.name
    if (body.unit !== undefined) updates.unit = body.unit ?? null
    if (body.direction !== undefined) updates.direction = body.direction
    if (body.baseline !== undefined) updates.baseline = String(body.baseline)
    if (body.current !== undefined) updates.current = String(body.current)
    if (body.target !== undefined) updates.target = body.target != null ? String(body.target) : null

    const [updated] = await db
      .update(strategyKpis)
      .set(updates)
      .where(eq(strategyKpis.id, id))
      .returning()
    return { success: true, kpi: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating KPI', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
