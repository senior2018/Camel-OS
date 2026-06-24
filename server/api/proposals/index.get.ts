import { consola } from 'consola'
import { and, asc, count, desc, eq, exists, or, sql } from 'drizzle-orm'

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
import { userHasPermission } from '@@/server/utils/role'
import { PROPOSAL_STATUSES, type ProposalStatus } from '@@/shared/schemas/proposal'

/**
 * List proposals visible to the caller. Need-to-know by default: a user sees a
 * proposal only if they are a member (an assignment) or its creator. Oversight
 * roles (system admin, or anyone with `proposal:admin`) see every proposal in
 * the org. Grouped by status so the board/filter render without a second fetch.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const db = useDrizzle()

    const canViewAll =
      ctx.isSystemAdmin || (await userHasPermission(ctx.userId, 'proposal', 'admin'))

    // Member = has any assignment on the proposal; creator = raised/owns it.
    const memberOrCreator = or(
      eq(proposals.createdByUserId, ctx.userId),
      exists(
        db
          .select({ one: proposalAssignments.proposalId })
          .from(proposalAssignments)
          .where(
            and(
              eq(proposalAssignments.proposalId, proposals.id),
              eq(proposalAssignments.assignedUserId, ctx.userId)
            )
          )
      )
    )
    const scope = canViewAll
      ? eq(proposals.organizationId, ctx.organizationId)
      : and(eq(proposals.organizationId, ctx.organizationId), memberOrCreator)

    // Scale guard: never load unbounded. Return the most relevant LIMIT rows
    // (deadline asc, newest first) plus the true total so the UI can prompt to
    // narrow down. Full per-page pagination can layer on this later.
    const LIMIT = 500
    const totalRows = await db
      .select({ total: count() })
      .from(proposals)
      .innerJoin(opportunities, eq(opportunities.id, proposals.opportunityId))
      .where(scope)
    const total = totalRows[0]?.total ?? 0

    // The client behind the proposal's opportunity — primary link first, oldest
    // as a stable fallback (mirrors the opportunities board).
    const primaryClientName = sql<string | null>`(
      SELECT ${clients.name} FROM ${opportunityClients}
      INNER JOIN ${clients} ON ${clients.id} = ${opportunityClients.clientId}
      WHERE ${opportunityClients.opportunityId} = ${proposals.opportunityId}
      ORDER BY ${opportunityClients.isPrimary} DESC, ${opportunityClients.createdAt} ASC
      LIMIT 1
    )`.as('primary_client_name')

    const rows = await db
      .select({
        id: proposals.id,
        opportunityId: proposals.opportunityId,
        title: proposals.title,
        status: proposals.status,
        deadline: proposals.deadline,
        submittedAt: proposals.submittedAt,
        decidedAt: proposals.decidedAt,
        reminderRecipientUserIds: proposals.reminderRecipientUserIds,
        createdAt: proposals.createdAt,
        updatedAt: proposals.updatedAt,
        createdByFirstName: users.firstName,
        createdByLastName: users.lastName,
        opportunityTitle: opportunities.title,
        opportunityStatus: opportunities.status,
        estimatedValue: opportunities.estimatedValue,
        currency: opportunities.currency,
        primaryClientName,
      })
      .from(proposals)
      .leftJoin(users, eq(users.id, proposals.createdByUserId))
      .innerJoin(opportunities, eq(opportunities.id, proposals.opportunityId))
      .where(scope)
      .orderBy(asc(proposals.deadline), desc(proposals.createdAt))
      .limit(LIMIT)

    const groupedByStatus: Record<ProposalStatus, typeof rows> = Object.fromEntries(
      PROPOSAL_STATUSES.map((s) => [s, [] as typeof rows])
    ) as Record<ProposalStatus, typeof rows>
    for (const row of rows) groupedByStatus[row.status].push(row)

    return {
      items: rows,
      groupedByStatus,
      total: total ?? rows.length,
      capped: (total ?? 0) > LIMIT,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing proposals', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
