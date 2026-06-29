import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { melIndicators, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { indicatorSchema } from '@@/shared/schemas/mel'

/** ME-01 — add a results-framework node / indicator. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, indicatorSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [created] = await db
      .insert(melIndicators)
      .values({
        organizationId: ctx.organizationId,
        projectId: id,
        parentId: body.parentId ?? null,
        level: body.level,
        name: body.name,
        baseline: body.baseline != null ? String(body.baseline) : null,
        target: body.target != null ? String(body.target) : null,
        unit: body.unit ?? null,
        frequency: body.frequency ?? null,
        dataSource: body.dataSource ?? null,
        orderIndex: body.orderIndex,
      })
      .returning()
    return { success: true, indicator: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating indicator', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
