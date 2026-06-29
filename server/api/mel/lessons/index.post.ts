import { consola } from 'consola'

import { melLessons } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { lessonSchema } from '@@/shared/schemas/mel'

/** ME-05 — capture a lesson learned. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'create')
    const body = await readValidatedBody(event, lessonSchema.parse)
    const [created] = await useDrizzle()
      .insert(melLessons)
      .values({
        organizationId: ctx.organizationId,
        projectId: body.projectId ?? null,
        title: body.title,
        description: body.description ?? null,
        sector: body.sector ?? null,
        tags: body.tags,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, lesson: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating lesson', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
