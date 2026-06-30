import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { departmentalGoals, individualObjectives, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { individualObjectiveSchema } from '@@/shared/schemas/strategy'

/** ST-05 — link an individual staff objective to a departmental goal. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'update')
    const goalId = getRouterParam(event, 'id')
    if (!goalId) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, (data: unknown) =>
      individualObjectiveSchema.parse({ ...(data as object), goalId })
    )
    const db = useDrizzle()

    const [goal] = await db
      .select({ id: departmentalGoals.id })
      .from(departmentalGoals)
      .where(
        and(
          eq(departmentalGoals.id, goalId),
          eq(departmentalGoals.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!goal) throw createError({ statusCode: 404, statusMessage: 'Goal not found' })

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, body.userId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Employee not found' })

    const [created] = await db
      .insert(individualObjectives)
      .values({
        organizationId: ctx.organizationId,
        goalId,
        userId: body.userId,
        title: body.title,
        description: body.description ?? null,
        progressPct: body.progressPct,
        status: body.status,
        dueDate: body.dueDate ?? null,
      })
      .returning()
    return { success: true, objective: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding individual objective', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
