import { consola } from 'consola'
import { asc, desc, eq } from 'drizzle-orm'

import { opportunities, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { PROPOSAL_STATUSES, type ProposalStatus } from '@@/shared/schemas/proposal'

/**
 * S7 — List every proposal in the caller's organization. Grouped by status so
 * the /proposals page can render columns or filter chips without a second
 * fetch. Opportunity title is joined so cards can show context.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const db = useDrizzle()

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
      })
      .from(proposals)
      .leftJoin(users, eq(users.id, proposals.createdByUserId))
      .innerJoin(opportunities, eq(opportunities.id, proposals.opportunityId))
      .where(eq(proposals.organizationId, ctx.organizationId))
      .orderBy(asc(proposals.deadline), desc(proposals.createdAt))

    const groupedByStatus: Record<ProposalStatus, typeof rows> = Object.fromEntries(
      PROPOSAL_STATUSES.map((s) => [s, [] as typeof rows])
    ) as Record<ProposalStatus, typeof rows>
    for (const row of rows) groupedByStatus[row.status].push(row)

    return { items: rows, groupedByStatus }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing proposals', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
