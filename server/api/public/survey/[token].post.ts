import { consola } from 'consola'
import { eq } from 'drizzle-orm'

import { melAnswers, melEvaluations, melResponses } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { evaluationResponseSchema } from '@@/shared/schemas/mel'

/** ME-04 — PUBLIC survey submission (token link). Only accepted while 'open'. */
export default defineEventHandler(async (event) => {
  try {
    const token = getRouterParam(event, 'token')
    if (!token) throw createError({ statusCode: 400, statusMessage: 'Token required' })
    const body = await readValidatedBody(event, evaluationResponseSchema.parse)
    const db = useDrizzle()

    const [evaluation] = await db
      .select({ id: melEvaluations.id, organizationId: melEvaluations.organizationId, status: melEvaluations.status })
      .from(melEvaluations)
      .where(eq(melEvaluations.publicToken, token))
      .limit(1)
    if (!evaluation) throw createError({ statusCode: 404, statusMessage: 'Survey not found' })
    if (evaluation.status !== 'open') {
      throw createError({ statusCode: 409, statusMessage: 'This survey is closed.' })
    }

    const [response] = await db
      .insert(melResponses)
      .values({
        organizationId: evaluation.organizationId,
        evaluationId: evaluation.id,
        respondentName: body.respondentName ?? null,
      })
      .returning({ id: melResponses.id })

    if (body.answers.length) {
      await db.insert(melAnswers).values(
        body.answers.map((a) => ({
          organizationId: evaluation.organizationId,
          responseId: response!.id,
          questionId: a.questionId,
          value: a.value,
        }))
      )
    }
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error submitting survey', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
