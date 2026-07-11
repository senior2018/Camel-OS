import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { growthPlans, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission, requireUser } from '@@/server/utils/permission-guard'
import { growthPlanSchema } from '@@/shared/schemas/hr'

/** EX-06 — create/update a growth plan (id = userId, upsert; self or hr:update). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const userId = getRouterParam(event, 'id')
    if (!userId) throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
    if (userId !== ctx.userId) await requirePermission(event, 'hr', 'update')
    const body = await readValidatedBody(event, growthPlanSchema.parse)
    const db = useDrizzle()

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Employee not found' })

    const values = {
      organizationId: ctx.organizationId,
      userId,
      periodLabel: body.periodLabel ?? null,
      reviewNotes: body.reviewNotes ?? null,
      goals: body.goals.map((g) => ({ ...g, status: g.status })),
      createdByUserId: ctx.userId,
      updatedAt: new Date(),
    }
    const [saved] = await db
      .insert(growthPlans)
      .values(values)
      .onConflictDoUpdate({
        target: growthPlans.userId,
        set: {
          periodLabel: values.periodLabel,
          reviewNotes: values.reviewNotes,
          goals: values.goals,
          updatedAt: new Date(),
        },
      })
      .returning()
    return { success: true, plan: saved }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving growth plan', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
