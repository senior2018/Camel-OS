import { consola } from 'consola'
import { and, eq, inArray, isNotNull, not } from 'drizzle-orm'

import { opportunities, users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { logAuditEvent } from './audit'
import { sendOpportunityDeadlineReminder } from './mailer'

/**
 * OM-07 — Email opportunity owners about upcoming deadlines.
 *
 * Run once per day. Fires for opportunities whose deadline falls *exactly* on
 * one of REMINDER_DAYS_OUT (14, 7, 2 days from now — per OM-07 acceptance).
 * Active stages only — we don't ping people about won/lost work.
 *
 * Returns a summary so the scheduled task can log it and admins can verify
 * with the manual trigger.
 */
const REMINDER_DAYS_OUT = [2, 7, 14] as const

function isoDateOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatValue(value: string | null, currency: string): string | null {
  if (!value) return null
  const n = Number(value)
  if (Number.isNaN(n)) return `${value} ${currency}`
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}

export interface ReminderSummary {
  scanned: number
  sent: number
  skipped: number
  errors: number
}

export async function sendDeadlineReminders(): Promise<ReminderSummary> {
  const db = useDrizzle()
  const summary: ReminderSummary = { scanned: 0, sent: 0, skipped: 0, errors: 0 }

  const targetDates = REMINDER_DAYS_OUT.map(isoDateOffset)

  const rows = await db
    .select({
      id: opportunities.id,
      organizationId: opportunities.organizationId,
      title: opportunities.title,
      deadline: opportunities.deadline,
      estimatedValue: opportunities.estimatedValue,
      currency: opportunities.currency,
      ownerUserId: opportunities.ownerUserId,
      createdByUserId: opportunities.createdByUserId,
      ownerEmail: users.email,
      ownerFirstName: users.firstName,
    })
    .from(opportunities)
    .leftJoin(users, eq(users.id, opportunities.ownerUserId))
    .where(
      and(
        isNotNull(opportunities.deadline),
        inArray(opportunities.deadline, targetDates),
        not(inArray(opportunities.stage, ['won', 'lost']))
      )
    )

  summary.scanned = rows.length
  const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'

  for (const opp of rows) {
    // Fall back to the creator when no explicit owner is assigned.
    let recipientEmail = opp.ownerEmail
    let recipientName = opp.ownerFirstName ?? 'there'

    if (!recipientEmail && opp.createdByUserId) {
      const [creator] = await db
        .select({ email: users.email, firstName: users.firstName })
        .from(users)
        .where(eq(users.id, opp.createdByUserId))
        .limit(1)
      if (creator) {
        recipientEmail = creator.email
        recipientName = creator.firstName ?? 'there'
      }
    }

    if (!recipientEmail || !opp.deadline) {
      summary.skipped++
      continue
    }

    const daysUntil = Math.round((new Date(opp.deadline).getTime() - Date.now()) / 86_400_000)

    try {
      await sendOpportunityDeadlineReminder(recipientEmail, {
        recipientName,
        title: opp.title,
        daysUntil,
        deadline: opp.deadline,
        valueLabel: formatValue(opp.estimatedValue, opp.currency),
        url: `${appUrl}/opportunities`,
      })
      summary.sent++
      await logAuditEvent({
        organizationId: opp.organizationId,
        userId: null,
        resource: 'opportunity',
        action: 'deadline_reminder_sent',
        resourceId: opp.id,
        meta: {
          title: opp.title,
          deadline: opp.deadline,
          daysUntil,
          recipient: recipientEmail,
        },
      })
    } catch (err) {
      summary.errors++
      consola.error(`Failed to send deadline reminder for opp ${opp.id}:`, err)
    }
  }

  return summary
}
