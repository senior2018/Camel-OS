import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { melIndicators } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { indicatorSchema } from '@@/shared/schemas/mel'

/** ME-01 — edit an indicator / framework node. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'update')
    const iid = getRouterParam(event, 'iid')
    if (!iid) throw createError({ statusCode: 400, statusMessage: 'Indicator ID is required' })
    const data = await readValidatedBody(event, indicatorSchema.partial().parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: melIndicators.id })
      .from(melIndicators)
      .where(and(eq(melIndicators.id, iid), eq(melIndicators.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Indicator not found' })

    const updates: Record<string, unknown> = {}
    if (data.level !== undefined) updates.level = data.level
    if (data.parentId !== undefined) updates.parentId = data.parentId ?? null
    if (data.name !== undefined) updates.name = data.name
    if (data.baseline !== undefined)
      updates.baseline = data.baseline != null ? String(data.baseline) : null
    if (data.target !== undefined) updates.target = data.target != null ? String(data.target) : null
    if (data.unit !== undefined) updates.unit = data.unit ?? null
    if (data.frequency !== undefined) updates.frequency = data.frequency ?? null
    if (data.dataSource !== undefined) updates.dataSource = data.dataSource ?? null
    if (data.orderIndex !== undefined) updates.orderIndex = data.orderIndex

    const [updated] = await db
      .update(melIndicators)
      .set(updates)
      .where(eq(melIndicators.id, iid))
      .returning()
    return { success: true, indicator: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating indicator', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
