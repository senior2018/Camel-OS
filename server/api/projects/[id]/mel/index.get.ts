import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { melDataPoints, melIndicators, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ME-01/03 — the project's results framework + all data points (dashboard feed). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const indicators = await db
      .select()
      .from(melIndicators)
      .where(eq(melIndicators.projectId, id))
      .orderBy(asc(melIndicators.orderIndex), asc(melIndicators.createdAt))

    const dataPoints = await db
      .select()
      .from(melDataPoints)
      .where(eq(melDataPoints.projectId, id))
      .orderBy(asc(melDataPoints.periodDate))

    return { indicators, dataPoints }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading MEL framework', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
