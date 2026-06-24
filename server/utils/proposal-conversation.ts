import { and, eq } from 'drizzle-orm'

import { proposalAssignments, proposalMessages, proposals } from '../database/schema'
import { useDrizzle } from './drizzle'
import { userHasPermission } from './role'

/**
 * Need-to-know access to a single proposal: a member (any assignment) or the
 * creator, plus oversight (system admin or `proposal:admin`). Mirrors the list
 * + detail scoping so every proposal-scoped sub-resource enforces it the same way.
 */
export async function canAccessProposal(opts: {
  proposalId: string
  organizationId: string
  userId: string
  isSystemAdmin: boolean
}): Promise<boolean> {
  const { proposalId, organizationId, userId, isSystemAdmin } = opts
  if (isSystemAdmin) return true
  const db = useDrizzle()

  const [proposal] = await db
    .select({ createdByUserId: proposals.createdByUserId })
    .from(proposals)
    .where(and(eq(proposals.id, proposalId), eq(proposals.organizationId, organizationId)))
    .limit(1)
  if (!proposal) return false
  if (proposal.createdByUserId === userId) return true

  if (await userHasPermission(userId, 'proposal', 'admin')) return true

  const [member] = await db
    .select({ one: proposalAssignments.proposalId })
    .from(proposalAssignments)
    .where(
      and(
        eq(proposalAssignments.proposalId, proposalId),
        eq(proposalAssignments.assignedUserId, userId)
      )
    )
    .limit(1)
  return !!member
}

/**
 * Post an auto-generated workflow event into a proposal's conversation
 * (e.g. "Rita approved", "Status → Shortlisted"). Best-effort: a failure here
 * must never break the underlying mutation, so callers ignore rejections.
 */
export async function postProposalSystemMessage(opts: {
  proposalId: string
  organizationId: string
  body: string
  eventType: string
  actorUserId?: string | null
}): Promise<void> {
  await useDrizzle()
    .insert(proposalMessages)
    .values({
      proposalId: opts.proposalId,
      organizationId: opts.organizationId,
      kind: 'system',
      body: opts.body,
      eventType: opts.eventType,
      authorUserId: opts.actorUserId ?? null,
    })
}
