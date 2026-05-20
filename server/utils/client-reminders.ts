import { consola } from 'consola'
import { and, eq, isNull, lte } from 'drizzle-orm'

import { clientReminders, clients, users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { logAuditEvent } from './audit'
import { sendClientReminderEmail } from './mailer'

/**
 * CR-05 — Email the assignee for every active client reminder that's due today
 * or overdue and hasn't been notified yet. Completed reminders are skipped; the
 * `notifiedAt` stamp prevents duplicate emails if the task re-runs the same day.
 *
 * In-app delivery (the second leg of the spec's "email/in-app notification"
 * acceptance) is wired in S26 when NT-01 ships — these rows are already shaped
 * for it: a future notifications worker can read `clientReminders` directly.
 */
export interface ClientReminderSummary {
  scanned: number
  sent: number
  skipped: number
  errors: number
}

export async function sendClientReminders(): Promise<ClientReminderSummary> {
  const db = useDrizzle()
  const summary: ClientReminderSummary = { scanned: 0, sent: 0, skipped: 0, errors: 0 }

  // Send for anything due now or earlier that hasn't been notified yet.
  const now = new Date()

  const rows = await db
    .select({
      id: clientReminders.id,
      organizationId: clientReminders.organizationId,
      clientId: clientReminders.clientId,
      message: clientReminders.message,
      dueAt: clientReminders.dueAt,
      assignedUserId: clientReminders.assignedUserId,
      clientName: clients.name,
      assigneeEmail: users.email,
      assigneeFirstName: users.firstName,
    })
    .from(clientReminders)
    .innerJoin(clients, eq(clients.id, clientReminders.clientId))
    .innerJoin(users, eq(users.id, clientReminders.assignedUserId))
    .where(
      and(
        isNull(clientReminders.completedAt),
        isNull(clientReminders.notifiedAt),
        lte(clientReminders.dueAt, now)
      )
    )

  summary.scanned = rows.length
  const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'

  for (const r of rows) {
    if (!r.assigneeEmail) {
      summary.skipped++
      continue
    }
    try {
      await sendClientReminderEmail(r.assigneeEmail, {
        recipientName: r.assigneeFirstName ?? 'there',
        clientName: r.clientName,
        message: r.message,
        dueAt:
          r.dueAt instanceof Date
            ? r.dueAt.toLocaleString(undefined, {
                dateStyle: 'medium',
                timeStyle: 'short',
              })
            : String(r.dueAt),
        url: `${appUrl}/clients/${r.clientId}`,
      })
      // Stamp first, then audit — so a failed audit doesn't trigger a re-send.
      await db
        .update(clientReminders)
        .set({ notifiedAt: new Date() })
        .where(eq(clientReminders.id, r.id))
      summary.sent++
      await logAuditEvent({
        organizationId: r.organizationId,
        userId: null,
        resource: 'client',
        action: 'reminder_sent',
        resourceId: r.clientId,
        meta: {
          reminderId: r.id,
          dueAt: r.dueAt instanceof Date ? r.dueAt.toISOString() : String(r.dueAt),
          recipient: r.assigneeEmail,
          clientName: r.clientName,
        },
      })
    } catch (err) {
      summary.errors++
      consola.error(`Failed to send client reminder ${r.id}:`, err)
    }
  }

  return summary
}
