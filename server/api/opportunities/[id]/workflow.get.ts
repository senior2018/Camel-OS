import { consola } from 'consola'
import { and, asc, eq, desc } from 'drizzle-orm'

import {
  opportunities,
  opportunityStageActivities,
  opportunityStageTransitions,
  users,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { seedActivitiesIfMissing } from '@@/server/utils/opportunity-workflow'

/**
 * Returns the workflow bundle for an opportunity: the activity checklist for
 * its CURRENT stage and the full transition history. The detail modal hydrates
 * its right-side panel from this one call.
 *
 * Side effect: if no activities exist yet for the current stage, we seed the
 * defaults on first read so older opportunities (created before this feature
 * shipped) light up with a sensible checklist.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const db = useDrizzle()

    const [opp] = await db
      .select({ id: opportunities.id, stage: opportunities.stage })
      .from(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)
    if (!opp) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })

    await seedActivitiesIfMissing(opp.id, ctx.organizationId, opp.stage)

    const activities = await db
      .select()
      .from(opportunityStageActivities)
      .where(
        and(
          eq(opportunityStageActivities.opportunityId, opp.id),
          eq(opportunityStageActivities.stage, opp.stage)
        )
      )
      .orderBy(asc(opportunityStageActivities.sortOrder), asc(opportunityStageActivities.createdAt))

    const transitions = await db
      .select({
        id: opportunityStageTransitions.id,
        fromStage: opportunityStageTransitions.fromStage,
        toStage: opportunityStageTransitions.toStage,
        comment: opportunityStageTransitions.comment,
        createdAt: opportunityStageTransitions.createdAt,
        userId: opportunityStageTransitions.userId,
        userFirstName: users.firstName,
        userLastName: users.lastName,
        userEmail: users.email,
      })
      .from(opportunityStageTransitions)
      .leftJoin(users, eq(users.id, opportunityStageTransitions.userId))
      .where(eq(opportunityStageTransitions.opportunityId, opp.id))
      .orderBy(desc(opportunityStageTransitions.createdAt))

    return { stage: opp.stage, activities, transitions }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching opportunity workflow', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
