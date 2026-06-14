import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { proposalSections, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const sections = await db
      .select({
        id: proposalSections.id,
        title: proposalSections.title,
        body: proposalSections.body,
        sortOrder: proposalSections.sortOrder,
        assignedToUserId: proposalSections.assignedToUserId,
        assignedToFirstName: users.firstName,
        assignedToLastName: users.lastName,
        updatedAt: proposalSections.updatedAt,
      })
      .from(proposalSections)
      .leftJoin(users, eq(users.id, proposalSections.assignedToUserId))
      .where(eq(proposalSections.proposalId, id))
      .orderBy(asc(proposalSections.sortOrder), asc(proposalSections.createdAt))

    return { sections }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing proposal sections', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
