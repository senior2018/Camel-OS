import { and, eq, inArray } from 'drizzle-orm'

import { proposalAssignments } from '../database/schema'
import { useDrizzle } from './drizzle'

/**
 * Record-level access for the proposal module (mirrors the opportunity
 * owner-scoping). Capability comes from RBAC (`proposal:update`); WHO may act on
 * a given proposal's content is scoped here by workflow role:
 *
 *   - Writers  = the Lead + contributors  → edit sections, upload docs, write.
 *   - Reviewers = the reviewer list       → comment + approve (not edit content).
 *
 * System admins bypass (god-mode), consistent with requirePermission.
 */
const WRITER_ROLES = ['lead', 'contributor'] as const

export async function isProposalWriter(
  proposalId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<boolean> {
  if (isSystemAdmin) return true
  const [row] = await useDrizzle()
    .select({ id: proposalAssignments.id })
    .from(proposalAssignments)
    .where(
      and(
        eq(proposalAssignments.proposalId, proposalId),
        eq(proposalAssignments.assignedUserId, userId),
        inArray(proposalAssignments.roleType, [...WRITER_ROLES])
      )
    )
    .limit(1)
  return !!row
}

/** True when the user is the proposal's Lead (or a system admin). */
export async function isProposalLead(
  proposalId: string,
  userId: string,
  isSystemAdmin: boolean
): Promise<boolean> {
  if (isSystemAdmin) return true
  const [row] = await useDrizzle()
    .select({ id: proposalAssignments.id })
    .from(proposalAssignments)
    .where(
      and(
        eq(proposalAssignments.proposalId, proposalId),
        eq(proposalAssignments.assignedUserId, userId),
        eq(proposalAssignments.roleType, 'lead')
      )
    )
    .limit(1)
  return !!row
}
