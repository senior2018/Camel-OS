import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'

import { proposalAssignments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { requirePermission } from '@@/server/utils/permission-guard'
import { saveProposalAssignmentsSchema } from '@@/shared/schemas/proposal-assignment'

/**
 * Batch reconcile the proposal team in ONE request: the body carries the full
 * desired set of role → user assignments. Roles omitted are unassigned, so this
 * single call covers assign, re-assign, and remove without per-row round-trips.
 * Assigning a Lead while the proposal is still `assigned` starts drafting.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const { assignments } = saveProposalAssignmentsSchema.parse(await readBody(event))

    // One user per role — guard against a malformed payload with duplicate roles.
    const seen = new Set<string>()
    for (const a of assignments) {
      if (seen.has(a.roleType)) {
        throw createError({ statusCode: 400, statusMessage: `Duplicate role: ${a.roleType}` })
      }
      seen.add(a.roleType)
    }

    const db = useDrizzle()

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    // Every assignee must belong to the org.
    if (assignments.length > 0) {
      const ids = [...new Set(assignments.map((a) => a.assignedUserId))]
      const found = await db
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, ids), eq(users.organizationId, ctx.organizationId)))
      if (found.length !== ids.length) {
        throw createError({ statusCode: 400, statusMessage: 'One or more users are invalid' })
      }
    }

    await db.transaction(async (tx) => {
      await tx.delete(proposalAssignments).where(eq(proposalAssignments.proposalId, id))
      if (assignments.length > 0) {
        await tx.insert(proposalAssignments).values(
          assignments.map((a) => ({
            proposalId: id,
            organizationId: ctx.organizationId,
            roleType: a.roleType,
            assignedUserId: a.assignedUserId,
          }))
        )
      }
      // Kick off drafting once a Lead exists.
      const hasLead = assignments.some((a) => a.roleType === 'lead')
      if (hasLead && proposal.status === 'assigned') {
        await tx.update(proposals).set({ status: 'drafting' }).where(eq(proposals.id, id))
      }
    })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'assignments_saved',
      resourceId: id,
      meta: { roles: assignments.map((a) => a.roleType) },
    })

    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:assignment',
      details: { count: assignments.length },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving proposal assignments', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
