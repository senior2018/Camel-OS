import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { melEvaluations } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ME-04 — delete an evaluation (its questions/responses cascade). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: melEvaluations.id })
      .from(melEvaluations)
      .where(and(eq(melEvaluations.id, id), eq(melEvaluations.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Evaluation not found' })

    await db.delete(melEvaluations).where(eq(melEvaluations.id, id))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting evaluation', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
