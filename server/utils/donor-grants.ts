import { consola } from 'consola'
import { and, eq, isNull, lte, ne, or } from 'drizzle-orm'

import { clients, donorGrants, users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { logAuditEvent } from './audit'
import { sendDonorGrantDeadlineEmail } from './mailer'

/**
 * CR-09 — Email a donor's account owner 30 days before a grant deadline
 * (`endDate` or `nextReportingDate`). The cron runs daily at 08:00 UTC.
 *
 * Two independent stamps prevent duplicate sends:
 *   - `endDateNotifiedAt` covers the grant end date
 *   - `nextReportingNotifiedAt` covers the next reporting deadline
 *
 * Stamps are cleared when the relevant date is changed by the user (see the
 * grant PATCH endpoint), so a re-scheduled deadline gets a fresh notification.
 */
export interface DonorGrantSummary {
  scanned: number
  sentEndDate: number
  sentReporting: number
  skipped: number
  errors: number
}

const REMINDER_WINDOW_DAYS = 30

function isoOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function sendDonorGrantDeadlineReminders(): Promise<DonorGrantSummary> {
  const db = useDrizzle()
  const summary: DonorGrantSummary = {
    scanned: 0,
    sentEndDate: 0,
    sentReporting: 0,
    skipped: 0,
    errors: 0,
  }

  const thresholdDate = isoOffset(REMINDER_WINDOW_DAYS)

  // Pull every active or pending grant where either the end date or the next
  // reporting date is within the 30-day window and hasn't been notified yet.
  const rows = await db
    .select({
      id: donorGrants.id,
      organizationId: donorGrants.organizationId,
      donorId: donorGrants.donorId,
      title: donorGrants.title,
      endDate: donorGrants.endDate,
      nextReportingDate: donorGrants.nextReportingDate,
      totalValue: donorGrants.totalValue,
      currency: donorGrants.currency,
      endDateNotifiedAt: donorGrants.endDateNotifiedAt,
      nextReportingNotifiedAt: donorGrants.nextReportingNotifiedAt,
      donorName: clients.name,
      ownerEmail: users.email,
      ownerFirstName: users.firstName,
    })
    .from(donorGrants)
    .innerJoin(clients, eq(clients.id, donorGrants.donorId))
    .leftJoin(users, eq(users.id, clients.ownerUserId))
    .where(
      and(
        // Only chase deadlines for grants still in motion.
        ne(donorGrants.status, 'completed'),
        ne(donorGrants.status, 'cancelled'),
        or(
          and(isNull(donorGrants.endDateNotifiedAt), lte(donorGrants.endDate, thresholdDate)),
          and(
            isNull(donorGrants.nextReportingNotifiedAt),
            lte(donorGrants.nextReportingDate, thresholdDate)
          )
        )
      )
    )

  summary.scanned = rows.length
  const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'

  for (const r of rows) {
    if (!r.ownerEmail) {
      summary.skipped++
      continue
    }
    const now = new Date()
    // Determine which deadline triggered this run — a single grant may have
    // both within the same window. Email each only once per row.
    const dueEnd =
      r.endDate && !r.endDateNotifiedAt && r.endDate <= thresholdDate ? r.endDate : null
    const dueReporting =
      r.nextReportingDate && !r.nextReportingNotifiedAt && r.nextReportingDate <= thresholdDate
        ? r.nextReportingDate
        : null

    try {
      if (dueEnd) {
        await sendDonorGrantDeadlineEmail(r.ownerEmail, {
          recipientName: r.ownerFirstName ?? 'there',
          donorName: r.donorName,
          grantTitle: r.title,
          deadlineKind: 'Grant end',
          deadlineDate: dueEnd,
          url: `${appUrl}/clients/${r.donorId}`,
        })
        await db.update(donorGrants).set({ endDateNotifiedAt: now }).where(eq(donorGrants.id, r.id))
        summary.sentEndDate++
        await logAuditEvent({
          organizationId: r.organizationId,
          userId: null,
          resource: 'client',
          action: 'grant_deadline_sent',
          resourceId: r.donorId,
          meta: {
            grantId: r.id,
            kind: 'end_date',
            deadlineDate: dueEnd,
            recipient: r.ownerEmail,
          },
        })
      }
      if (dueReporting) {
        await sendDonorGrantDeadlineEmail(r.ownerEmail, {
          recipientName: r.ownerFirstName ?? 'there',
          donorName: r.donorName,
          grantTitle: r.title,
          deadlineKind: 'Reporting',
          deadlineDate: dueReporting,
          url: `${appUrl}/clients/${r.donorId}`,
        })
        await db
          .update(donorGrants)
          .set({ nextReportingNotifiedAt: now })
          .where(eq(donorGrants.id, r.id))
        summary.sentReporting++
        await logAuditEvent({
          organizationId: r.organizationId,
          userId: null,
          resource: 'client',
          action: 'grant_deadline_sent',
          resourceId: r.donorId,
          meta: {
            grantId: r.id,
            kind: 'reporting',
            deadlineDate: dueReporting,
            recipient: r.ownerEmail,
          },
        })
      }
    } catch (err) {
      summary.errors++
      consola.error(`Failed to send grant deadline reminder ${r.id}:`, err)
    }
  }

  return summary
}
