import { consola } from 'consola'
import { desc, eq, sql } from 'drizzle-orm'

import { melEvaluations, melResponses, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ME-04 — evaluations list with response counts. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'read')
    const db = useDrizzle()
    const rows = await db
      .select({
        id: melEvaluations.id,
        title: melEvaluations.title,
        status: melEvaluations.status,
        projectName: projects.name,
        createdAt: melEvaluations.createdAt,
        responses: sql<number>`(select count(*) from ${melResponses} where ${melResponses.evaluationId} = ${melEvaluations.id})::int`,
      })
      .from(melEvaluations)
      .leftJoin(projects, eq(projects.id, melEvaluations.projectId))
      .where(eq(melEvaluations.organizationId, ctx.organizationId))
      .orderBy(desc(melEvaluations.createdAt))
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing evaluations', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
