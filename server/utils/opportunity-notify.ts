import { consola } from 'consola'
import { eq } from 'drizzle-orm'

import { users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { sendOpportunityAssignmentEmail } from './mailer'

interface OpportunityForNotify {
  id: string
  title: string
  deadline: string | null
  estimatedValue: string | null
  currency: string
}

/**
 * OM-05 — send the newly assigned owner an email about the opportunity.
 * Best-effort: failures are logged but don't surface to the caller, since
 * a missing email shouldn't block the create/update transaction.
 */
export async function notifyOpportunityOwnerAssignment(
  ownerUserId: string,
  assignerUserId: string,
  opp: OpportunityForNotify
): Promise<void> {
  try {
    const db = useDrizzle()
    const [owner] = await db
      .select({ email: users.email, firstName: users.firstName })
      .from(users)
      .where(eq(users.id, ownerUserId))
      .limit(1)
    if (!owner?.email) return

    const [assigner] = await db
      .select({ firstName: users.firstName, lastName: users.lastName, email: users.email })
      .from(users)
      .where(eq(users.id, assignerUserId))
      .limit(1)
    const assignerName =
      [assigner?.firstName, assigner?.lastName].filter(Boolean).join(' ') ||
      assigner?.email ||
      'A teammate'

    const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
    const valueLabel = opp.estimatedValue
      ? `${Number(opp.estimatedValue).toLocaleString(undefined, { maximumFractionDigits: 0 })} ${opp.currency}`
      : null

    await sendOpportunityAssignmentEmail(owner.email, {
      recipientName: owner.firstName ?? 'there',
      title: opp.title,
      assignerName,
      deadline: opp.deadline,
      valueLabel,
      url: `${appUrl}/opportunities`,
    })
  } catch (err) {
    consola.error('Failed to send opportunity assignment email', err)
  }
}
