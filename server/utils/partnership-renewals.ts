import { consola } from 'consola'
import { and, eq, isNotNull, isNull, lte, ne, or } from 'drizzle-orm'

import { clients, partnershipAgreements, users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { logAuditEvent } from './audit'
import { sendPartnershipRenewalEmail } from './mailer'
import { buildRecipientList, fetchRecipientUsers } from './reminder-recipients'

/**
 * CR-11 — Partnership-agreement renewal reminders.
 *
 * Two windows fire from a single daily sweep:
 *   - 90 days before `endDate` (early heads-up so the renewal conversation can start)
 *   - 30 days before `endDate` (final reminder if the 90-day window passed quietly)
 *
 * Each window has its own idempotency stamp on the row so the cron sends each
 * notification exactly once. The PATCH endpoint clears both stamps when
 * `endDate` is changed so a re-scheduled agreement gets fresh notifications.
 *
 * Only agreements with status 'active' (or 'draft' close to going active) and a
 * non-null endDate are considered.
 */
export interface PartnershipRenewalSummary {
  scanned: number
  sent90: number
  sent30: number
  skipped: number
  errors: number
}

const WINDOW_90 = 90
const WINDOW_30 = 30

function isoOffset(days: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export async function sendPartnershipRenewalReminders(): Promise<PartnershipRenewalSummary> {
  const db = useDrizzle()
  const summary: PartnershipRenewalSummary = {
    scanned: 0,
    sent90: 0,
    sent30: 0,
    skipped: 0,
    errors: 0,
  }

  const threshold90 = isoOffset(WINDOW_90)
  const threshold30 = isoOffset(WINDOW_30)

  const rows = await db
    .select({
      id: partnershipAgreements.id,
      organizationId: partnershipAgreements.organizationId,
      partnerId: partnershipAgreements.partnerId,
      title: partnershipAgreements.title,
      endDate: partnershipAgreements.endDate,
      renewalNotifiedAt90: partnershipAgreements.renewalNotifiedAt90,
      renewalNotifiedAt30: partnershipAgreements.renewalNotifiedAt30,
      partnerName: clients.name,
      ownerEmail: users.email,
      ownerFirstName: users.firstName,
      recipientIds: clients.reminderRecipientUserIds,
    })
    .from(partnershipAgreements)
    .innerJoin(clients, eq(clients.id, partnershipAgreements.partnerId))
    .leftJoin(users, eq(users.id, clients.ownerUserId))
    .where(
      and(
        isNotNull(partnershipAgreements.endDate),
        ne(partnershipAgreements.status, 'expired'),
        ne(partnershipAgreements.status, 'terminated'),
        or(
          and(
            isNull(partnershipAgreements.renewalNotifiedAt90),
            lte(partnershipAgreements.endDate, threshold90)
          ),
          and(
            isNull(partnershipAgreements.renewalNotifiedAt30),
            lte(partnershipAgreements.endDate, threshold30)
          )
        )
      )
    )

  summary.scanned = rows.length
  const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
  const todayMs = Date.now()
  const userMap = await fetchRecipientUsers(rows.flatMap((r) => r.recipientIds ?? []))

  for (const r of rows) {
    if (!r.endDate) {
      summary.skipped++
      continue
    }
    // Owner + the partner's extra recipient list, de-duplicated.
    const recipients = buildRecipientList(
      r.ownerEmail ? { email: r.ownerEmail, firstName: r.ownerFirstName } : null,
      r.recipientIds,
      userMap
    )
    if (recipients.length === 0) {
      summary.skipped++
      continue
    }

    const due90 =
      r.endDate && !r.renewalNotifiedAt90 && r.endDate <= threshold90 && r.endDate > threshold30
    const due30 = r.endDate && !r.renewalNotifiedAt30 && r.endDate <= threshold30
    const now = new Date()
    const daysUntil = Math.ceil((new Date(r.endDate).getTime() - todayMs) / (24 * 60 * 60 * 1000))

    try {
      if (due90) {
        for (const rec of recipients) {
          await sendPartnershipRenewalEmail(rec.email, {
            recipientName: rec.firstName ?? 'there',
            partnerName: r.partnerName,
            agreementTitle: r.title,
            daysUntil,
            endDate: r.endDate,
            url: `${appUrl}/clients/${r.partnerId}`,
          })
        }
        await db
          .update(partnershipAgreements)
          .set({ renewalNotifiedAt90: now })
          .where(eq(partnershipAgreements.id, r.id))
        summary.sent90++
        await logAuditEvent({
          organizationId: r.organizationId,
          userId: null,
          resource: 'client',
          action: 'agreement_renewal_sent',
          resourceId: r.partnerId,
          meta: {
            agreementId: r.id,
            window: '90d',
            endDate: r.endDate,
            recipients: recipients.map((x) => x.email),
          },
        })
      }
      if (due30) {
        for (const rec of recipients) {
          await sendPartnershipRenewalEmail(rec.email, {
            recipientName: rec.firstName ?? 'there',
            partnerName: r.partnerName,
            agreementTitle: r.title,
            daysUntil,
            endDate: r.endDate,
            url: `${appUrl}/clients/${r.partnerId}`,
          })
        }
        await db
          .update(partnershipAgreements)
          .set({ renewalNotifiedAt30: now })
          .where(eq(partnershipAgreements.id, r.id))
        summary.sent30++
        await logAuditEvent({
          organizationId: r.organizationId,
          userId: null,
          resource: 'client',
          action: 'agreement_renewal_sent',
          resourceId: r.partnerId,
          meta: {
            agreementId: r.id,
            window: '30d',
            endDate: r.endDate,
            recipients: recipients.map((x) => x.email),
          },
        })
      }
    } catch (err) {
      summary.errors++
      consola.error(`Failed to send partnership renewal ${r.id}:`, err)
    }
  }

  return summary
}
