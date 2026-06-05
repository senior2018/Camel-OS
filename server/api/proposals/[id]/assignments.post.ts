import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalAssignments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit-log'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createProposalAssignmentSchema } from '@@/shared/schemas/proposal-assignment'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })
    }

    const body = await readBody(event)
    const payload = createProposalAssignmentSchema.parse(body)

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

    // Check if user exists in org
    const [assignedUser] = await db
      .select()
      .from(users)
      .where(eq(users.id, payload.assignedUserId))
      .limit(1)

    if (!assignedUser) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    // Remove existing assignment of this role if it exists
    await db
      .delete(proposalAssignments)
      .where(
        and(
          eq(proposalAssignments.proposalId, id),
          eq(proposalAssignments.roleType, payload.roleType)
        )
      )

    // Create new assignment
    const [assignment] = await db
      .insert(proposalAssignments)
      .values({
        proposalId: id,
        organizationId: ctx.organizationId,
        roleType: payload.roleType,
        assignedUserId: payload.assignedUserId,
      })
      .returning()

    // Log audit event
    await logAuditEvent({
      event,
      action: 'proposal:assignment',
      details: {
        proposalId: id,
        role: payload.roleType,
        assignedUserId: payload.assignedUserId,
      },
    })

    return {
      success: true,
      assignment,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error assigning team member', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
