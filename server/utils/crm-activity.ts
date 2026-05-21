import { and, between, count, countDistinct, eq, gte, lte, sql } from 'drizzle-orm'

import { clientInteractions, opportunities, users } from '../database/schema'
import { useDrizzle } from './drizzle'

/**
 * CR-06 — Computes the metrics behind the CRM activity report.
 *
 * Shared between the JSON endpoint (`/api/reports/crm-activity`) and the CSV
 * export (`/api/reports/crm-activity.csv`) so the two views can't drift.
 *
 * The `from`/`to` are inclusive ISO dates (YYYY-MM-DD). `userId` filters all
 * three metrics to interactions created by that user and opportunities owned by
 * (or created by) them; leaving it empty surfaces firm-wide totals.
 */
export interface CrmActivityFilters {
  from: string
  to: string
  userId?: string | null
}

export interface CrmActivityReport {
  filters: CrmActivityFilters
  totals: {
    contactsReached: number
    meetingsHeld: number
    interactionsLogged: number
  }
  pipelineValueByCurrency: Record<string, number>
  byInteractionType: Array<{ type: string; count: number }>
  byUser: Array<{
    userId: string
    userName: string
    interactionsLogged: number
    meetingsHeld: number
  }>
}

export async function buildCrmActivityReport(
  organizationId: string,
  filters: CrmActivityFilters
): Promise<CrmActivityReport> {
  const db = useDrizzle()
  const fromDate = new Date(`${filters.from}T00:00:00.000Z`)
  // Make `to` inclusive: end at the start of the next day.
  const toDate = new Date(`${filters.to}T00:00:00.000Z`)
  toDate.setUTCDate(toDate.getUTCDate() + 1)

  // Interaction-side conditions
  const interactionConds = [
    eq(clientInteractions.organizationId, organizationId),
    gte(clientInteractions.occurredAt, fromDate),
    lte(clientInteractions.occurredAt, toDate),
  ]
  if (filters.userId) interactionConds.push(eq(clientInteractions.createdByUserId, filters.userId))

  // 1. Headline counts in one query.
  const [headline] = await db
    .select({
      contactsReached: countDistinct(clientInteractions.contactId),
      interactionsLogged: count(clientInteractions.id),
      meetingsHeld: sql<number>`COUNT(*) FILTER (WHERE ${clientInteractions.type} = 'meeting')::int`,
    })
    .from(clientInteractions)
    .where(and(...interactionConds))

  // 2. Per-type breakdown.
  const byTypeRows = await db
    .select({
      type: clientInteractions.type,
      count: count(clientInteractions.id),
    })
    .from(clientInteractions)
    .where(and(...interactionConds))
    .groupBy(clientInteractions.type)

  // 3. Per-user breakdown (only when not already filtered to one user).
  const byUserRows = filters.userId
    ? []
    : await db
        .select({
          userId: clientInteractions.createdByUserId,
          userFirstName: users.firstName,
          userLastName: users.lastName,
          userEmail: users.email,
          interactionsLogged: count(clientInteractions.id),
          meetingsHeld: sql<number>`COUNT(*) FILTER (WHERE ${clientInteractions.type} = 'meeting')::int`,
        })
        .from(clientInteractions)
        .leftJoin(users, eq(users.id, clientInteractions.createdByUserId))
        .where(and(...interactionConds))
        .groupBy(clientInteractions.createdByUserId, users.firstName, users.lastName, users.email)

  // 4. Pipeline value — sum of opportunity estimated_value where the opportunity
  // was created OR updated within the period. Grouped by currency since the
  // firm operates in mixed currencies and summing across is misleading.
  const oppConds = [
    eq(opportunities.organizationId, organizationId),
    between(opportunities.updatedAt, fromDate, toDate),
  ]
  if (filters.userId) oppConds.push(eq(opportunities.ownerUserId, filters.userId))

  const pipelineRows = await db
    .select({
      currency: opportunities.currency,
      total: sql<string>`COALESCE(SUM(${opportunities.estimatedValue}), 0)::text`,
    })
    .from(opportunities)
    .where(and(...oppConds))
    .groupBy(opportunities.currency)

  const pipelineValueByCurrency: Record<string, number> = {}
  for (const r of pipelineRows) {
    pipelineValueByCurrency[r.currency] = Number(r.total)
  }

  return {
    filters,
    totals: {
      contactsReached: Number(headline?.contactsReached ?? 0),
      interactionsLogged: Number(headline?.interactionsLogged ?? 0),
      meetingsHeld: Number(headline?.meetingsHeld ?? 0),
    },
    pipelineValueByCurrency,
    byInteractionType: byTypeRows.map((r) => ({ type: r.type, count: Number(r.count) })),
    byUser: byUserRows.map((r) => ({
      userId: r.userId ?? '',
      userName:
        [r.userFirstName, r.userLastName].filter(Boolean).join(' ') || r.userEmail || 'Unknown',
      interactionsLogged: Number(r.interactionsLogged),
      meetingsHeld: Number(r.meetingsHeld),
    })),
  }
}
