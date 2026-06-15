import { consola } from 'consola'
import { inArray } from 'drizzle-orm'

import { users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { sendProposalAssignmentEmail } from './mailer'
import {
  PROPOSAL_ASSIGNMENT_ROLE_LABEL,
  type ProposalAssignmentRole,
} from '@@/shared/schemas/proposal-assignment'

interface ProposalForNotify {
  id: string
  title: string
  deadline: string | null
}

/**
 * PM-02 — email newly assigned proposal team members. Best-effort: a missing
 * email or a send failure is logged but never blocks the assignment save.
 * `assignments` should be only the members NEW to the team (so re-saving the
 * same roster doesn't re-spam everyone).
 */
export async function notifyProposalAssignments(
  proposal: ProposalForNotify,
  assignerUserId: string,
  assignments: { roleType: ProposalAssignmentRole; assignedUserId: string }[]
): Promise<void> {
  if (!assignments.length) return
  try {
    const db = useDrizzle()
    const ids = [...new Set([assignerUserId, ...assignments.map((a) => a.assignedUserId)])]
    const rows = await db
      .select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(users)
      .where(inArray(users.id, ids))
    const byId = new Map(rows.map((r) => [r.id, r]))

    const assigner = byId.get(assignerUserId)
    const assignerName =
      [assigner?.firstName, assigner?.lastName].filter(Boolean).join(' ') ||
      assigner?.email ||
      'A teammate'
    const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
    const url = `${appUrl}/proposals/${proposal.id}`

    await Promise.all(
      assignments.map(async (a) => {
        const u = byId.get(a.assignedUserId)
        if (!u?.email) return
        await sendProposalAssignmentEmail(u.email, {
          recipientName: u.firstName ?? 'there',
          proposalTitle: proposal.title,
          roleLabel: PROPOSAL_ASSIGNMENT_ROLE_LABEL[a.roleType],
          assignerName,
          deadline: proposal.deadline,
          url,
        })
      })
    )
  } catch (err) {
    consola.error('Failed to send proposal assignment emails', err)
  }
}
