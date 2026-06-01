import { consola } from 'consola'
import { and, asc, count, desc, eq, gte, inArray, isNotNull, lte, ne, sql } from 'drizzle-orm'

import {
  clientInteractions,
  clients,
  donorGrants,
  partnershipAgreements,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * CR-12 — Donor / partner relationship dashboard data.
 *
 * Pulls totals, upcoming deadlines (grants + agreements), recent communication
 * volume per type, and the at-risk relationships (no interaction in 60 days).
 * Everything is scoped to the caller's organization.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'read')
    const db = useDrizzle()
    const orgFilter = eq(clients.organizationId, ctx.organizationId)

    const toIso = (offsetDays: number) => {
      const d = new Date()
      d.setUTCDate(d.getUTCDate() + offsetDays)
      return d.toISOString().slice(0, 10)
    }
    const today = toIso(0)
    const in60 = toIso(60)
    const in90 = toIso(90)
    const past60 = new Date()
    past60.setUTCDate(past60.getUTCDate() - 60)

    // Headline counts per relationship type.
    const typeCounts = await db
      .select({ type: clients.type, count: count() })
      .from(clients)
      .where(and(orgFilter, inArray(clients.type, ['donor', 'partner'])))
      .groupBy(clients.type)

    const totals = {
      donors: typeCounts.find((r) => r.type === 'donor')?.count ?? 0,
      partners: typeCounts.find((r) => r.type === 'partner')?.count ?? 0,
    }

    // Active grant aggregates — count + total funding by currency.
    const grantStats = await db
      .select({
        count: count(),
        currency: donorGrants.currency,
        sum: sql<string>`COALESCE(SUM(${donorGrants.totalValue}), 0)`,
      })
      .from(donorGrants)
      .where(
        and(eq(donorGrants.organizationId, ctx.organizationId), eq(donorGrants.status, 'active'))
      )
      .groupBy(donorGrants.currency)

    const activeGrants = {
      count: grantStats.reduce((s, r) => s + Number(r.count), 0),
      totalsByCurrency: grantStats.map((r) => ({
        currency: r.currency,
        amount: r.sum,
      })),
    }

    // Active agreements — count + total value by currency.
    const agreementStats = await db
      .select({
        count: count(),
        currency: partnershipAgreements.currency,
        sum: sql<string>`COALESCE(SUM(${partnershipAgreements.value}), 0)`,
      })
      .from(partnershipAgreements)
      .where(
        and(
          eq(partnershipAgreements.organizationId, ctx.organizationId),
          eq(partnershipAgreements.status, 'active')
        )
      )
      .groupBy(partnershipAgreements.currency)

    const activeAgreements = {
      count: agreementStats.reduce((s, r) => s + Number(r.count), 0),
      totalsByCurrency: agreementStats.map((r) => ({
        currency: r.currency,
        amount: r.sum,
      })),
    }

    // Upcoming grant deadlines (next 60 days) — top 5 closest.
    const upcomingGrants = await db
      .select({
        id: donorGrants.id,
        title: donorGrants.title,
        endDate: donorGrants.endDate,
        donorId: donorGrants.donorId,
        donorName: clients.name,
        totalValue: donorGrants.totalValue,
        currency: donorGrants.currency,
      })
      .from(donorGrants)
      .innerJoin(clients, eq(clients.id, donorGrants.donorId))
      .where(
        and(
          eq(donorGrants.organizationId, ctx.organizationId),
          isNotNull(donorGrants.endDate),
          gte(donorGrants.endDate, today),
          lte(donorGrants.endDate, in60),
          ne(donorGrants.status, 'completed'),
          ne(donorGrants.status, 'cancelled')
        )
      )
      .orderBy(asc(donorGrants.endDate))
      .limit(5)

    // Upcoming partnership renewals (next 90 days) — top 5 closest.
    const upcomingRenewals = await db
      .select({
        id: partnershipAgreements.id,
        title: partnershipAgreements.title,
        endDate: partnershipAgreements.endDate,
        partnerId: partnershipAgreements.partnerId,
        partnerName: clients.name,
        value: partnershipAgreements.value,
        currency: partnershipAgreements.currency,
      })
      .from(partnershipAgreements)
      .innerJoin(clients, eq(clients.id, partnershipAgreements.partnerId))
      .where(
        and(
          eq(partnershipAgreements.organizationId, ctx.organizationId),
          isNotNull(partnershipAgreements.endDate),
          gte(partnershipAgreements.endDate, today),
          lte(partnershipAgreements.endDate, in90),
          ne(partnershipAgreements.status, 'expired'),
          ne(partnershipAgreements.status, 'terminated')
        )
      )
      .orderBy(asc(partnershipAgreements.endDate))
      .limit(5)

    // Communication-type breakdown (last 90 days, donor/partner only).
    const past90 = new Date()
    past90.setUTCDate(past90.getUTCDate() - 90)
    const commTypeStats = await db
      .select({
        type: clientInteractions.type,
        count: count(),
      })
      .from(clientInteractions)
      .innerJoin(clients, eq(clients.id, clientInteractions.clientId))
      .where(
        and(
          eq(clientInteractions.organizationId, ctx.organizationId),
          inArray(clients.type, ['donor', 'partner']),
          gte(clientInteractions.occurredAt, past90)
        )
      )
      .groupBy(clientInteractions.type)

    // Recent donor/partner communications (top 5).
    const recentComms = await db
      .select({
        id: clientInteractions.id,
        type: clientInteractions.type,
        occurredAt: clientInteractions.occurredAt,
        summary: clientInteractions.summary,
        clientId: clients.id,
        clientName: clients.name,
        clientType: clients.type,
      })
      .from(clientInteractions)
      .innerJoin(clients, eq(clients.id, clientInteractions.clientId))
      .where(
        and(
          eq(clientInteractions.organizationId, ctx.organizationId),
          inArray(clients.type, ['donor', 'partner'])
        )
      )
      .orderBy(desc(clientInteractions.occurredAt))
      .limit(5)

    // At-risk relationships — donors/partners with no interaction in 60 days.
    // We pull a small list (top 10) since this is a watch-list, not a report.
    const atRiskClients = await db
      .select({
        id: clients.id,
        name: clients.name,
        type: clients.type,
        lastInteractionAt: sql<string | null>`MAX(${clientInteractions.occurredAt})`,
      })
      .from(clients)
      .leftJoin(clientInteractions, eq(clientInteractions.clientId, clients.id))
      .where(and(orgFilter, inArray(clients.type, ['donor', 'partner'])))
      .groupBy(clients.id)
      .having(
        sql`MAX(${clientInteractions.occurredAt}) IS NULL OR MAX(${clientInteractions.occurredAt}) < ${past60.toISOString()}`
      )
      .orderBy(sql`MAX(${clientInteractions.occurredAt}) NULLS FIRST`)
      .limit(10)

    return {
      totals,
      activeGrants,
      activeAgreements,
      upcomingGrants,
      upcomingRenewals,
      commTypeStats,
      recentComms,
      atRiskClients,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching donor-partner dashboard', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
