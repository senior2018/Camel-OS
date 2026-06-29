import { randomUUID } from 'node:crypto'

import { consola } from 'consola'

import { melEvaluations } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { evaluationSchema } from '@@/shared/schemas/mel'

/** ME-04 — create an evaluation (gets a public distribution token). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'create')
    const body = await readValidatedBody(event, evaluationSchema.parse)
    const [created] = await useDrizzle()
      .insert(melEvaluations)
      .values({
        organizationId: ctx.organizationId,
        projectId: body.projectId ?? null,
        title: body.title,
        description: body.description ?? null,
        status: 'draft',
        publicToken: `${randomUUID()}${randomUUID()}`.replace(/-/g, ''),
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, evaluation: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating evaluation', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
