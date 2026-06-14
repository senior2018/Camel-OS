import { consola } from 'consola'
import { and, eq, gte, inArray, lte } from 'drizzle-orm'

import {
  clients,
  opportunities,
  opportunityClients,
  proposalAssignments,
  proposals,
  users,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * BD-03 — Win/loss analysis. Outcomes (won / contract_signed = won, lost) joined
 * with sector (opportunity type), the primary client, and the proposal Lead
 * (team). Filterable by decided-date period (?from=YYYY-MM-DD&to=YYYY-MM-DD).
 */
type Bucket = { won: number; lost: number }
function rate(b: Bucket): number | null {
  const total = b.won + b.lost
  return total ? Math.round((b.won / total) * 100) : null
}

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const q = getQuery(event)
    const from = typeof q.from === 'string' && q.from ? q.from : null
    const to = typeof q.to === 'string' && q.to ? q.to : null

    const db = useDrizzle()
    const conds = [
      eq(proposals.organizationId, ctx.organizationId),
      inArray(proposals.status, ['won', 'contract_signed', 'lost']),
    ]
    if (from) conds.push(gte(proposals.decidedAt, new Date(from)))
    if (to) conds.push(lte(proposals.decidedAt, new Date(`${to}T23:59:59`)))

    const rows = await db
      .select({
        id: proposals.id,
        status: proposals.status,
        decidedAt: proposals.decidedAt,
        title: proposals.title,
        value: opportunities.estimatedValue,
        currency: opportunities.currency,
        sector: opportunities.type,
        clientName: clients.name,
        clientIndustry: clients.industry,
        leadFirstName: users.firstName,
        leadLastName: users.lastName,
      })
      .from(proposals)
      .innerJoin(opportunities, eq(opportunities.id, proposals.opportunityId))
      .leftJoin(
        opportunityClients,
        and(
          eq(opportunityClients.opportunityId, opportunities.id),
          eq(opportunityClients.isPrimary, true)
        )
      )
      .leftJoin(clients, eq(clients.id, opportunityClients.clientId))
      .leftJoin(
        proposalAssignments,
        and(
          eq(proposalAssignments.proposalId, proposals.id),
          eq(proposalAssignments.roleType, 'lead')
        )
      )
      .leftJoin(users, eq(users.id, proposalAssignments.assignedUserId))
      .where(and(...conds))

    const overall: Bucket = { won: 0, lost: 0 }
    const bySector = new Map<string, Bucket>()
    const byClient = new Map<string, Bucket>()
    const byTeam = new Map<string, Bucket>()
    const add = (m: Map<string, Bucket>, key: string, won: boolean) => {
      const b = m.get(key) ?? { won: 0, lost: 0 }
      if (won) b.won++
      else b.lost++
      m.set(key, b)
    }

    for (const r of rows) {
      const won = r.status === 'won' || r.status === 'contract_signed'
      if (won) overall.won++
      else overall.lost++
      add(bySector, r.clientIndustry || r.sector || 'Unspecified', won)
      add(byClient, r.clientName || 'Unspecified', won)
      add(byTeam, [r.leadFirstName, r.leadLastName].filter(Boolean).join(' ') || 'Unassigned', won)
    }

    const toRows = (m: Map<string, Bucket>) =>
      [...m.entries()]
        .map(([key, b]) => ({ key, won: b.won, lost: b.lost, winRate: rate(b) }))
        .sort((a, b) => b.won + b.lost - (a.won + a.lost))

    return {
      overall: { ...overall, winRate: rate(overall), total: overall.won + overall.lost },
      bySector: toRows(bySector),
      byClient: toRows(byClient),
      byTeam: toRows(byTeam),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building win/loss report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
