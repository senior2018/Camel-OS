import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'
import { feedbackItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { FEEDBACK_STATUSES } from '@@/shared/schemas/launch'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const b = await readValidatedBody(event, z.object({ status: z.enum(FEEDBACK_STATUSES) }).parse)
    await useDrizzle()
      .update(feedbackItems)
      .set({ status: b.status })
      .where(and(eq(feedbackItems.id, id), eq(feedbackItems.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error(error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
