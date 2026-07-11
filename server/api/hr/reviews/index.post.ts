import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { performanceReviews, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { reviewSchema } from '@@/shared/schemas/hr'

/** HR-05 — initiate a performance review for a staff member. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'create')
    const body = await readValidatedBody(event, reviewSchema.parse)
    const db = useDrizzle()

    const [subject] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, body.subjectUserId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!subject) throw createError({ statusCode: 404, statusMessage: 'Employee not found' })

    const [created] = await db
      .insert(performanceReviews)
      .values({
        organizationId: ctx.organizationId,
        subjectUserId: body.subjectUserId,
        periodLabel: body.periodLabel ?? null,
        status: 'draft',
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, review: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating review', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
