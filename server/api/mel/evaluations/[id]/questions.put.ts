import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { melEvaluations, melQuestions } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { evaluationQuestionsSchema } from '@@/shared/schemas/mel'

/** ME-04 — set the evaluation's questions (replaces the set). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, evaluationQuestionsSchema.parse)
    const db = useDrizzle()

    const [evaluation] = await db
      .select({ id: melEvaluations.id })
      .from(melEvaluations)
      .where(and(eq(melEvaluations.id, id), eq(melEvaluations.organizationId, ctx.organizationId)))
      .limit(1)
    if (!evaluation) throw createError({ statusCode: 404, statusMessage: 'Evaluation not found' })

    await db.delete(melQuestions).where(eq(melQuestions.evaluationId, id))
    if (body.questions.length) {
      await db.insert(melQuestions).values(
        body.questions.map((q, i) => ({
          organizationId: ctx.organizationId,
          evaluationId: id,
          type: q.type,
          prompt: q.prompt,
          options: q.options,
          required: q.required,
          orderIndex: i,
        }))
      )
    }
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving questions', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
