import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalAssignments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })
    }

    const db = useDrizzle()

    // Check if proposal exists
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)

    if (!proposal) {
      throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })
    }

    const assignments = await db
      .select({
        id: proposalAssignments.id,
        roleType: proposalAssignments.roleType,
        assignedUserId: proposalAssignments.assignedUserId,
        assignedAt: proposalAssignments.assignedAt,
        assignedUserEmail: users.email,
        assignedUserFirstName: users.firstName,
        assignedUserLastName: users.lastName,
      })
      .from(proposalAssignments)
      .leftJoin(users, eq(users.id, proposalAssignments.assignedUserId))
      .where(eq(proposalAssignments.proposalId, id))

    return {
      assignments,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching assignments', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
