import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { growthPlans, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission, requireUser } from '@@/server/utils/permission-guard'

/** EX-06 — a staff member's growth plan (id = userId; self or hr:read). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const userId = getRouterParam(event, 'id')
    if (!userId) throw createError({ statusCode: 400, statusMessage: 'User ID is required' })
    if (userId !== ctx.userId) await requirePermission(event, 'hr', 'read')
    const db = useDrizzle()

    const [user] = await db
      .select({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
        email: users.email,
      })
      .from(users)
      .where(and(eq(users.id, userId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Employee not found' })

    const [plan] = await db
      .select()
      .from(growthPlans)
      .where(eq(growthPlans.userId, userId))
      .limit(1)
    return { user, plan: plan ?? null, canEditSelf: userId === ctx.userId }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading growth plan', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
