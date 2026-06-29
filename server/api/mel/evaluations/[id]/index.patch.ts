import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { melEvaluations } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { EVALUATION_STATUSES, evaluationSchema } from '@@/shared/schemas/mel'

const patchSchema = evaluationSchema
  .partial()
  .extend({ status: z.enum(EVALUATION_STATUSES).optional() })

/** ME-04 — edit an evaluation or open/close it for responses. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const data = await readValidatedBody(event, patchSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: melEvaluations.id })
      .from(melEvaluations)
      .where(and(eq(melEvaluations.id, id), eq(melEvaluations.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Evaluation not found' })

    const updates: Record<string, unknown> = {}
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description ?? null
    if (data.projectId !== undefined) updates.projectId = data.projectId ?? null
    if (data.status !== undefined) updates.status = data.status

    const [updated] = await db
      .update(melEvaluations)
      .set(updates)
      .where(eq(melEvaluations.id, id))
      .returning()
    return { success: true, evaluation: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating evaluation', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
