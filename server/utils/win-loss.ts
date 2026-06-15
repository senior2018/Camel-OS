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

/**
 * BD-03 — Win/loss analysis builder shared by the JSON report endpoint and the
 * CSV export. Outcomes (won / contract_signed = won, lost) joined with sector
 * (client industry, falling back to opportunity type), the primary client, and
 * the proposal Lead (team). Filterable by decided-date period.
 */
export interface WinLossBucket {
  won: number
  lost: number
}
export interface WinLossRow {
  key: string
  won: number
  lost: number
  winRate: number | null
}
export interface WinLossReport {
  overall: { won: number; lost: number; winRate: number | null; total: number }
  bySector: WinLossRow[]
  byClient: WinLossRow[]
  byTeam: WinLossRow[]
}

function rate(b: WinLossBucket): number | null {
  const total = b.won + b.lost
  return total ? Math.round((b.won / total) * 100) : null
}

export async function buildWinLossReport(
  organizationId: string,
  opts: { from?: string | null; to?: string | null } = {}
): Promise<WinLossReport> {
  const db = useDrizzle()
  const conds = [
    eq(proposals.organizationId, organizationId),
    inArray(proposals.status, ['won', 'contract_signed', 'lost']),
  ]
  if (opts.from) conds.push(gte(proposals.decidedAt, new Date(opts.from)))
  if (opts.to) conds.push(lte(proposals.decidedAt, new Date(`${opts.to}T23:59:59`)))

  const rows = await db
    .select({
      status: proposals.status,
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

  const overall: WinLossBucket = { won: 0, lost: 0 }
  const bySector = new Map<string, WinLossBucket>()
  const byClient = new Map<string, WinLossBucket>()
  const byTeam = new Map<string, WinLossBucket>()
  const add = (m: Map<string, WinLossBucket>, key: string, won: boolean) => {
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

  const toRows = (m: Map<string, WinLossBucket>): WinLossRow[] =>
    [...m.entries()]
      .map(([key, b]) => ({ key, won: b.won, lost: b.lost, winRate: rate(b) }))
      .sort((a, b) => b.won + b.lost - (a.won + a.lost))

  return {
    overall: { ...overall, winRate: rate(overall), total: overall.won + overall.lost },
    bySector: toRows(bySector),
    byClient: toRows(byClient),
    byTeam: toRows(byTeam),
  }
}
