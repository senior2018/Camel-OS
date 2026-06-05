import { consola } from 'consola'
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm'

import { clients, clientInteractions, opportunityClients, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * Returns all clients for the caller's organization with denormalized counts and
 * the most recent interaction timestamp. Used by the list view (CR-01).
 *
 * Search query (`?q=`) matches name, email, country, and industry — broad enough
 * for the typical "find that energy-sector client we met last quarter" task.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'read')

    const q = (getQuery(event).q as string | undefined)?.trim() ?? ''
    const typeFilter = getQuery(event).type as string | undefined

    const conds = [eq(clients.organizationId, ctx.organizationId)]
    if (q) {
      const like = `%${q}%`
      conds.push(
        or(
          ilike(clients.name, like),
          ilike(clients.email, like),
          ilike(clients.country, like),
          ilike(clients.industry, like)
        )!
      )
    }
    if (typeFilter === 'client' || typeFilter === 'prospect') {
      conds.push(eq(clients.type, typeFilter))
    }

    // One pass: clients + owner + aggregate counts via correlated subqueries.
    // Cheap for the per-org sizes we expect (low thousands) and keeps the
    // response self-contained so the table renders without follow-up fetches.
    const interactionCount = sql<number>`(
      SELECT COUNT(*)::int FROM ${clientInteractions}
      WHERE ${clientInteractions.clientId} = ${clients.id}
    )`.as('interaction_count')

    const lastInteractionAt = sql<string | null>`(
      SELECT MAX(${clientInteractions.occurredAt}) FROM ${clientInteractions}
      WHERE ${clientInteractions.clientId} = ${clients.id}
    )`.as('last_interaction_at')

    const opportunityCount = sql<number>`(
      SELECT COUNT(*)::int FROM ${opportunityClients}
      WHERE ${opportunityClients.clientId} = ${clients.id}
    )`.as('opportunity_count')

    const rows = await useDrizzle()
      .select({
        id: clients.id,
        name: clients.name,
        firstName: clients.firstName,
        lastName: clients.lastName,
        organization: clients.organization,
        type: clients.type,
        industry: clients.industry,
        country: clients.country,
        website: clients.website,
        phone: clients.phone,
        email: clients.email,
        ownerUserId: clients.ownerUserId,
        ownerEmail: users.email,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
        interactionCount,
        lastInteractionAt,
        opportunityCount,
      })
      .from(clients)
      .leftJoin(users, eq(users.id, clients.ownerUserId))
      .where(and(...conds))
      .orderBy(desc(clients.updatedAt), asc(clients.name))

    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing clients', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
