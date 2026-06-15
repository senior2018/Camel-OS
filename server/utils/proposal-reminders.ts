import { consola } from 'consola'
import { and, inArray, isNotNull } from 'drizzle-orm'

import { proposals } from '../database/schema'
import { useDrizzle } from './drizzle'
import { logAuditEvent } from './audit'
import { sendProposalDeadlineReminder } from './mailer'
import { buildRecipientList, fetchRecipientUsers } from './reminder-recipients'

/**
 * Proposal deadline reminders — the multi-recipient fan-out the proposal module
 * captured (`reminderRecipientUserIds`) but never dispatched.
 *
 * Run once per day. Fires for proposals whose submission deadline falls exactly
 * on one of REMINDER_DAYS_OUT (2, 7, 14 days out). Pre-submission statuses only —
 * once a proposal is submitted or decided the deadline is moot. Emails the
 * creator plus every configured extra recipient (de-duplicated by email).
 */
const REMINDER_DAYS_OUT = [2, 7, 14] as const

// Statuses where a submission deadline still matters (before it is submitted).
const ACTIVE_STATUSES = [
  'assigned',
  'drafting',
  'awaiting_review',
  'revision_required',
  'ready_for_final_approval',
  'awaiting_final_approval',
  'final_approved',
] as const

function isoDateOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export interface ProposalReminderSummary {
  scanned: number
  sent: number
  skipped: number
  errors: number
}

export async function sendProposalDeadlineReminders(): Promise<ProposalReminderSummary> {
  const db = useDrizzle()
  const summary: ProposalReminderSummary = { scanned: 0, sent: 0, skipped: 0, errors: 0 }
  const targetDates = REMINDER_DAYS_OUT.map(isoDateOffset)

  const rows = await db
    .select({
      id: proposals.id,
      organizationId: proposals.organizationId,
      title: proposals.title,
      deadline: proposals.deadline,
      createdByUserId: proposals.createdByUserId,
      reminderRecipientUserIds: proposals.reminderRecipientUserIds,
    })
    .from(proposals)
    .where(
      and(
        isNotNull(proposals.deadline),
        inArray(proposals.deadline, targetDates),
        inArray(proposals.status, [...ACTIVE_STATUSES])
      )
    )

  summary.scanned = rows.length
  const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'

  for (const p of rows) {
    if (!p.deadline) {
      summary.skipped++
      continue
    }
    const ownerId = p.createdByUserId
    const extraIds = p.reminderRecipientUserIds ?? []
    const userMap = await fetchRecipientUsers([...(ownerId ? [ownerId] : []), ...extraIds])
    const owner = ownerId ? (userMap.get(ownerId) ?? null) : null
    const recipients = buildRecipientList(owner, extraIds, userMap)

    if (!recipients.length) {
      summary.skipped++
      continue
    }

    const daysUntil = Math.round((new Date(p.deadline).getTime() - Date.now()) / 86_400_000)
    for (const r of recipients) {
      try {
        await sendProposalDeadlineReminder(r.email, {
          recipientName: r.firstName ?? 'there',
          title: p.title,
          daysUntil,
          deadline: p.deadline,
          url: `${appUrl}/proposals/${p.id}`,
        })
        summary.sent++
      } catch (err) {
        summary.errors++
        consola.error(`Failed to send proposal reminder for ${p.id} to ${r.email}:`, err)
      }
    }

    await logAuditEvent({
      organizationId: p.organizationId,
      userId: null,
      resource: 'proposal',
      action: 'deadline_reminder_sent',
      resourceId: p.id,
      meta: { title: p.title, deadline: p.deadline, daysUntil, recipients: recipients.length },
    })
  }

  return summary
}
