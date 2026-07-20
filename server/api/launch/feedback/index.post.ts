import { consola } from 'consola'
import { feedbackItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { createFeedbackSchema } from '@@/shared/schemas/launch'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const b = await readValidatedBody(event, createFeedbackSchema.parse)
    await useDrizzle()
      .insert(feedbackItems)
      .values({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        category: b.category,
        message: b.message,
        pageUrl: b.pageUrl ?? null,
      })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error(error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
