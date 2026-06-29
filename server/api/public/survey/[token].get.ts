import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { melEvaluations, melQuestions } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'

/** ME-04 — PUBLIC survey form (token link). Only servable while 'open'. */
export default defineEventHandler(async (event) => {
  try {
    const token = getRouterParam(event, 'token')
    if (!token) throw createError({ statusCode: 400, statusMessage: 'Token required' })
    const db = useDrizzle()

    const [evaluation] = await db
      .select({
        id: melEvaluations.id,
        title: melEvaluations.title,
        description: melEvaluations.description,
        status: melEvaluations.status,
      })
      .from(melEvaluations)
      .where(eq(melEvaluations.publicToken, token))
      .limit(1)
    if (!evaluation) throw createError({ statusCode: 404, statusMessage: 'Survey not found' })

    if (evaluation.status !== 'open') {
      return { evaluation: { title: evaluation.title, status: evaluation.status }, questions: [], closed: true }
    }

    const questions = await db
      .select({
        id: melQuestions.id,
        type: melQuestions.type,
        prompt: melQuestions.prompt,
        options: melQuestions.options,
        required: melQuestions.required,
      })
      .from(melQuestions)
      .where(eq(melQuestions.evaluationId, evaluation.id))
      .orderBy(asc(melQuestions.orderIndex))

    return {
      evaluation: { title: evaluation.title, description: evaluation.description, status: evaluation.status },
      questions,
      closed: false,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading survey', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
