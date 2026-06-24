import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'
import { z } from 'zod'

import { proposalAssignments, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { isProposalLead } from '@@/server/utils/proposal-access'
import { notifyProposalAssignments } from '@@/server/utils/proposal-notify'
import { resolveProposalSettings } from '@@/server/utils/proposal-settings'
import { requirePermission } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'
import { roleTypeForBehavior, type ProposalRoleDef } from '@@/shared/schemas/proposal-settings'

const bodySchema = z.object({
  members: z
    .array(z.object({ userId: z.string().uuid(), roleKey: z.string().min(1).max(40) }))
    .max(60),
})

/**
 * P3.4 — Manage Access. Reconciles a proposal's whole membership against a
 * desired list of { userId, roleKey }, where roleKey is one of the org's (or
 * the proposal's) configured roles. One role per person, so separation of
 * duties (writer vs reviewer) is automatic. The Lead, a manager (proposal:admin)
 * or a system admin may manage access.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const { members } = bodySchema.parse(await readBody(event))
    const db = useDrizzle()

    const [proposal] = await db
      .select()
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const canManage =
      ctx.isSystemAdmin ||
      (await isProposalLead(id, ctx.userId, ctx.isSystemAdmin)) ||
      (await userHasPermission(ctx.userId, 'proposal', 'admin'))
    if (!canManage) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the Lead or a manager can manage access',
      })
    }

    const settings = await resolveProposalSettings(proposal)
    const roleByKey = new Map<string, ProposalRoleDef>(settings.roles.map((r) => [r.key, r]))

    // No duplicate users.
    const seenUsers = new Set<string>()
    for (const m of members) {
      if (seenUsers.has(m.userId)) {
        throw createError({ statusCode: 400, statusMessage: 'A person can hold only one role' })
      }
      seenUsers.add(m.userId)
      if (!roleByKey.has(m.roleKey)) {
        throw createError({ statusCode: 400, statusMessage: `Unknown role: ${m.roleKey}` })
      }
    }

    // Single-instance roles (e.g. Lead, Final Approver) — at most one holder.
    const singleCounts = new Map<string, number>()
    for (const m of members) {
      const role = roleByKey.get(m.roleKey)!
      if (role.singleInstance) singleCounts.set(m.roleKey, (singleCounts.get(m.roleKey) ?? 0) + 1)
    }
    for (const [key, count] of singleCounts) {
      if (count > 1) {
        throw createError({
          statusCode: 400,
          statusMessage: `Only one ${roleByKey.get(key)?.label} allowed`,
        })
      }
    }

    // Validate org membership of every assignee.
    if (members.length) {
      const ids = [...seenUsers]
      const found = await db
        .select({ id: users.id })
        .from(users)
        .where(and(inArray(users.id, ids), eq(users.organizationId, ctx.organizationId)))
      if (found.length !== ids.length) {
        throw createError({ statusCode: 400, statusMessage: 'One or more users are invalid' })
      }
    }

    const prior = await db
      .select({ assignedUserId: proposalAssignments.assignedUserId })
      .from(proposalAssignments)
      .where(eq(proposalAssignments.proposalId, id))
    const priorIds = new Set(prior.map((p) => p.assignedUserId))

    const hasLead = members.some((m) => roleByKey.get(m.roleKey)?.behavior === 'lead')

    await db.transaction(async (tx) => {
      await tx.delete(proposalAssignments).where(eq(proposalAssignments.proposalId, id))
      if (members.length) {
        await tx.insert(proposalAssignments).values(
          members.map((m) => {
            const role = roleByKey.get(m.roleKey)!
            return {
              proposalId: id,
              organizationId: ctx.organizationId,
              roleType: roleTypeForBehavior(role.behavior),
              roleLabel: role.label,
              assignedUserId: m.userId,
            }
          })
        )
      }
      if (hasLead && proposal.status === 'assigned') {
        await tx.update(proposals).set({ status: 'drafting' }).where(eq(proposals.id, id))
      }
    })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'access_updated',
      resourceId: id,
      meta: { members: members.length },
    })
    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:assignment',
      details: { members: members.length },
    })

    // Email people new to the proposal (best-effort).
    const added = members
      .filter((m) => !priorIds.has(m.userId))
      .map((m) => ({
        roleType: roleTypeForBehavior(roleByKey.get(m.roleKey)!.behavior),
        assignedUserId: m.userId,
      }))
    await notifyProposalAssignments(
      { id, title: proposal.title, deadline: proposal.deadline },
      ctx.userId,
      added
    )

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating proposal access', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
