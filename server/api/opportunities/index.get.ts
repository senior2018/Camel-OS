import { consola } from 'consola'
import { asc, desc, eq } from 'drizzle-orm'

import { opportunities, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { OPPORTUNITY_STAGES, type OpportunityStage } from '@@/shared/schemas/opportunity'

/**
 * Returns all opportunities for the caller's organization, sorted by deadline asc
 * (nulls last) then created_at desc. The response includes an extra `grouped`
 * field keyed by stage so the Kanban view can render without a second fetch.
 *
 * OM-03: Kanban-style pipeline reads this endpoint.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')

    const rows = await useDrizzle()
      .select({
        id: opportunities.id,
        title: opportunities.title,
        source: opportunities.source,
        type: opportunities.type,
        stage: opportunities.stage,
        deadline: opportunities.deadline,
        estimatedValue: opportunities.estimatedValue,
        currency: opportunities.currency,
        winProbability: opportunities.winProbability,
        ownerUserId: opportunities.ownerUserId,
        ownerEmail: users.email,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        approvedToPursueAt: opportunities.approvedToPursueAt,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
      })
      .from(opportunities)
      .leftJoin(users, eq(users.id, opportunities.ownerUserId))
      .where(eq(opportunities.organizationId, ctx.organizationId))
      .orderBy(asc(opportunities.deadline), desc(opportunities.createdAt))

    // Initialise every stage so the Kanban renders empty columns too.
    const grouped: Record<OpportunityStage, typeof rows> = Object.fromEntries(
      OPPORTUNITY_STAGES.map((stage) => [stage, [] as typeof rows])
    ) as Record<OpportunityStage, typeof rows>

    for (const row of rows) grouped[row.stage].push(row)

    return { items: rows, grouped }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing opportunities', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
