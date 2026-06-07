import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalAssignments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createProposalAssignmentSchema } from '@@/shared/schemas/proposal-assignment'

/**
 * Assign (or re-assign) a team member to a proposal role. Assigning the Lead on
 * a freshly-created proposal moves it from `assigned` → `drafting` so the
 * workflow can begin. One user per role; re-assigning replaces the prior holder.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const body = await readBody(event)
    const payload = createProposalAssignmentSchema.parse(body)

    const db = useDrizzle()

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)

    if (!proposal) {
      throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })
    }

    const [assignedUser] = await db
      .select({ id: users.id, firstName: users.firstName, lastName: users.lastName })
      .from(users)
      .where(
        and(eq(users.id, payload.assignedUserId), eq(users.organizationId, ctx.organizationId))
      )
      .limit(1)

    if (!assignedUser) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    // Replace any existing holder of this role, then insert the new one.
    await db
      .delete(proposalAssignments)
      .where(
        and(
          eq(proposalAssignments.proposalId, id),
          eq(proposalAssignments.roleType, payload.roleType)
        )
      )

    const [assignment] = await db
      .insert(proposalAssignments)
      .values({
        proposalId: id,
        organizationId: ctx.organizationId,
        roleType: payload.roleType,
        assignedUserId: payload.assignedUserId,
      })
      .returning()

    // Assigning the Lead kicks off drafting.
    if (payload.roleType === 'lead' && proposal.status === 'assigned') {
      await db.update(proposals).set({ status: 'drafting' }).where(eq(proposals.id, id))
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'assignment',
      resourceId: id,
      meta: { role: payload.roleType, assignedUserId: payload.assignedUserId },
    })

    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:assignment',
      details: {
        role: payload.roleType,
        assignedName: [assignedUser.firstName, assignedUser.lastName].filter(Boolean).join(' '),
      },
    })

    return { success: true, assignment }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error assigning team member', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
