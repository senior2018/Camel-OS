import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'

import { proposalAssignments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { isProposalLead } from '@@/server/utils/proposal-access'
import { notifyProposalAssignments } from '@@/server/utils/proposal-notify'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  GROUP_ROLES,
  SINGLE_INSTANCE_ROLES,
  saveProposalTeamSchema,
} from '@@/shared/schemas/proposal-assignment'

/**
 * Group-scoped team reconcile. The body carries a `group` ('writing' | 'review')
 * and the desired assignments for THAT group only — the other team is left
 * untouched, so the Lead managing contributors never wipes the manager's
 * reviewers and vice-versa.
 *
 * Access:
 *   - review group  (lead, reviewers, final approver) → manager-level proposal:update
 *   - writing group (contributors)                    → the proposal Lead (or admin)
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const { group, assignments } = saveProposalTeamSchema.parse(await readBody(event))
    const allowedRoles = GROUP_ROLES[group]

    // Every assignment must belong to the declared group.
    for (const a of assignments) {
      if (!allowedRoles.includes(a.roleType)) {
        throw createError({
          statusCode: 400,
          statusMessage: `Role ${a.roleType} is not part of the ${group} team`,
        })
      }
    }
    // Single-instance roles (lead, final approver) — at most one each.
    for (const role of SINGLE_INSTANCE_ROLES) {
      if (assignments.filter((a) => a.roleType === role).length > 1) {
        throw createError({ statusCode: 400, statusMessage: `Only one ${role} allowed` })
      }
    }

    const db = useDrizzle()
    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    // PM-02 — staffing the writing team is the Proposal Lead's job (the manager
    // only appoints the Lead + reviewers + final approver). Enforce Lead-only.
    if (group === 'writing' && !(await isProposalLead(id, ctx.userId, ctx.isSystemAdmin))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the Proposal Lead can manage writers',
      })
    }

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

    // Snapshot the current roster for this group so we only email NEW members.
    const existing = await db
      .select({
        roleType: proposalAssignments.roleType,
        assignedUserId: proposalAssignments.assignedUserId,
      })
      .from(proposalAssignments)
      .where(
        and(
          eq(proposalAssignments.proposalId, id),
          inArray(proposalAssignments.roleType, allowedRoles)
        )
      )
    const existingKeys = new Set(existing.map((e) => `${e.roleType}:${e.assignedUserId}`))

    await db.transaction(async (tx) => {
      // Replace only this group's roles.
      await tx
        .delete(proposalAssignments)
        .where(
          and(
            eq(proposalAssignments.proposalId, id),
            inArray(proposalAssignments.roleType, allowedRoles)
          )
        )
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
      // Assigning the Lead kicks off drafting.
      if (
        group === 'review' &&
        assignments.some((a) => a.roleType === 'lead') &&
        proposal.status === 'assigned'
      ) {
        await tx.update(proposals).set({ status: 'drafting' }).where(eq(proposals.id, id))
      }
    })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'team_saved',
      resourceId: id,
      meta: { group, roles: assignments.map((a) => a.roleType) },
    })
    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:assignment',
      details: { group, count: assignments.length },
    })

    // PM-02 — email members new to this group (best-effort, never blocks).
    const added = assignments.filter((a) => !existingKeys.has(`${a.roleType}:${a.assignedUserId}`))
    await notifyProposalAssignments(
      { id, title: proposal.title, deadline: proposal.deadline },
      ctx.userId,
      added
    )

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving proposal team', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
