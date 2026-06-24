import { consola } from 'consola'
import { asc, count, desc, eq, sql } from 'drizzle-orm'

import { clients, opportunities, opportunityClients, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STATUSES,
  type OpportunityStage,
  type OpportunityStatus,
} from '@@/shared/schemas/opportunity'

/**
 * Returns all opportunities for the caller's organization, sorted by deadline asc
 * (nulls last) then created_at desc. The response includes an extra `groupedByStatus`
 * field keyed by status so the status-columns view can render without a second fetch.
 *
 * S7: replaced stage Kanban with Pending / Accepted / Rejected status columns.
 * Legacy `grouped` (by stage) is kept on the response for any caller that
 * still reads it; remove once every reader is migrated.
 */
// Scale guard — never load an unbounded pipeline into the browser.
const OPP_LIMIT = 500

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')

    // Show the primary client when one exists, otherwise fall back to any
    // linked client. ORDER BY is_primary DESC, created_at ASC means: primary
    // first (true > false), then the oldest non-primary as a stable tiebreaker.
    // Without the fallback, opportunities linked from the client side without
    // the primary flag appeared as "no client" on the card.
    const primaryClientId = sql<string | null>`(
      SELECT ${opportunityClients.clientId} FROM ${opportunityClients}
      WHERE ${opportunityClients.opportunityId} = ${opportunities.id}
      ORDER BY ${opportunityClients.isPrimary} DESC, ${opportunityClients.createdAt} ASC
      LIMIT 1
    )`.as('primary_client_id')

    const primaryClientName = sql<string | null>`(
      SELECT ${clients.name} FROM ${opportunityClients}
      INNER JOIN ${clients} ON ${clients.id} = ${opportunityClients.clientId}
      WHERE ${opportunityClients.opportunityId} = ${opportunities.id}
      ORDER BY ${opportunityClients.isPrimary} DESC, ${opportunityClients.createdAt} ASC
      LIMIT 1
    )`.as('primary_client_name')

    const rows = await useDrizzle()
      .select({
        id: opportunities.id,
        title: opportunities.title,
        description: opportunities.description,
        source: opportunities.source,
        type: opportunities.type,
        stage: opportunities.stage,
        status: opportunities.status,
        tags: opportunities.tags,
        winProbability: opportunities.winProbability,
        winProbabilitySource: opportunities.winProbabilitySource,
        deadline: opportunities.deadline,
        estimatedValue: opportunities.estimatedValue,
        currency: opportunities.currency,
        ownerUserId: opportunities.ownerUserId,
        createdByUserId: opportunities.createdByUserId,
        ownerEmail: users.email,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        approvedToPursueAt: opportunities.approvedToPursueAt,
        createdAt: opportunities.createdAt,
        updatedAt: opportunities.updatedAt,
        primaryClientId,
        primaryClientName,
      })
      .from(opportunities)
      .leftJoin(users, eq(users.id, opportunities.ownerUserId))
      .where(eq(opportunities.organizationId, ctx.organizationId))
      .orderBy(asc(opportunities.deadline), desc(opportunities.createdAt))
      .limit(OPP_LIMIT)

    const totalRows = await useDrizzle()
      .select({ total: count() })
      .from(opportunities)
      .where(eq(opportunities.organizationId, ctx.organizationId))
    const total = totalRows[0]?.total ?? 0

    // Status columns (S7) — Pending / Accepted / Rejected.
    const groupedByStatus: Record<OpportunityStatus, typeof rows> = Object.fromEntries(
      OPPORTUNITY_STATUSES.map((s) => [s, [] as typeof rows])
    ) as Record<OpportunityStatus, typeof rows>
    for (const row of rows) groupedByStatus[row.status].push(row)

    // Legacy stage groups — kept until every UI reader is migrated to status.
    const grouped: Record<OpportunityStage, typeof rows> = Object.fromEntries(
      OPPORTUNITY_STAGES.map((stage) => [stage, [] as typeof rows])
    ) as Record<OpportunityStage, typeof rows>
    for (const row of rows) grouped[row.stage].push(row)

    return {
      items: rows,
      grouped,
      groupedByStatus,
      total: total ?? rows.length,
      capped: (total ?? 0) > OPP_LIMIT,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing opportunities', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
