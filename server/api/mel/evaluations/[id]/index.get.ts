import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { melAnswers, melEvaluations, melQuestions, melResponses } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ME-04 — evaluation detail: questions + responses + flat answers to aggregate. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const db = useDrizzle()

    const [evaluation] = await db
      .select()
      .from(melEvaluations)
      .where(and(eq(melEvaluations.id, id), eq(melEvaluations.organizationId, ctx.organizationId)))
      .limit(1)
    if (!evaluation) throw createError({ statusCode: 404, statusMessage: 'Evaluation not found' })

    const questions = await db
      .select()
      .from(melQuestions)
      .where(eq(melQuestions.evaluationId, id))
      .orderBy(asc(melQuestions.orderIndex))

    const responses = await db
      .select({
        id: melResponses.id,
        respondentName: melResponses.respondentName,
        submittedAt: melResponses.submittedAt,
      })
      .from(melResponses)
      .where(eq(melResponses.evaluationId, id))

    const answers = await db
      .select({ questionId: melAnswers.questionId, value: melAnswers.value })
      .from(melAnswers)
      .where(eq(melAnswers.organizationId, ctx.organizationId))
    // Filter to this evaluation's questions (answers are org-scoped; join by question set).
    const qIds = new Set(questions.map((q) => q.id))
    const scoped = answers.filter((a) => qIds.has(a.questionId))

    return { evaluation, questions, responses, answers: scoped }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading evaluation', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
