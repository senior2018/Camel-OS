import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { melDataPoints, melIndicators, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { dataPointSchema } from '@@/shared/schemas/mel'

/** ME-02 — record a data point against an indicator. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'create')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, dataPointSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [indicator] = await db
      .select({ id: melIndicators.id })
      .from(melIndicators)
      .where(and(eq(melIndicators.id, body.indicatorId), eq(melIndicators.projectId, id)))
      .limit(1)
    if (!indicator) throw createError({ statusCode: 404, statusMessage: 'Indicator not found' })

    await db.insert(melDataPoints).values({
      organizationId: ctx.organizationId,
      projectId: id,
      indicatorId: body.indicatorId,
      periodDate: body.periodDate,
      value: String(body.value),
      note: body.note ?? null,
      evidenceUrl: body.evidenceUrl ? body.evidenceUrl : null,
      enteredByUserId: ctx.userId,
    })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error recording data point', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
