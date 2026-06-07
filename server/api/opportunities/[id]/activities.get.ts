import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { opportunityActivities, opportunities, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Opportunity ID is required' })
    }

    const db = useDrizzle()

    // Check if opportunity exists
    const [opportunity] = await db
      .select()
      .from(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)

    if (!opportunity) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    const activities = await db
      .select({
        id: opportunityActivities.id,
        action: opportunityActivities.action,
        details: opportunityActivities.details,
        createdAt: opportunityActivities.createdAt,
        userName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(opportunityActivities)
      .leftJoin(users, eq(users.id, opportunityActivities.userId))
      .where(eq(opportunityActivities.opportunityId, id))
      .orderBy(desc(opportunityActivities.createdAt))

    return {
      activities,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching activities', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
