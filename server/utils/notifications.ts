import { consola } from 'consola'
import { inArray } from 'drizzle-orm'

import { notificationPreferences, notifications, users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { sendNotificationEmail } from './mailer'
import { categoryForType } from '@@/shared/schemas/notifications'

export interface NotificationInput {
  organizationId: string
  userId: string
  type: string
  title: string
  body?: string | null
  linkUrl?: string | null
}

/**
 * Create one or more notifications: always the in-app bell feed (NT-01/03), and
 * a mirroring email (NT-01) to each recipient whose per-category email
 * preference is on. Default is email-on per category unless the user opted out.
 * Best-effort throughout — a failure is logged but never blocks the trigger.
 */
export async function createNotifications(rows: NotificationInput[]): Promise<void> {
  const clean = rows.filter((r) => r.userId)
  if (!clean.length) return
  const db = useDrizzle()
  try {
    await db.insert(notifications).values(
      clean.map((r) => ({
        organizationId: r.organizationId,
        userId: r.userId,
        type: r.type,
        title: r.title,
        body: r.body ?? null,
        linkUrl: r.linkUrl ?? null,
      }))
    )
  } catch (err) {
    consola.error('Failed to create notifications', err)
    return
  }

  // NT-01 — email delivery, gated by each recipient's per-category preference.
  try {
    const userIds = [...new Set(clean.map((r) => r.userId))]
    const recipients = await db
      .select({ id: users.id, email: users.email })
      .from(users)
      .where(inArray(users.id, userIds))
    const emailById = new Map(recipients.map((u) => [u.id, u.email]))
    const prefRows = await db
      .select({
        userId: notificationPreferences.userId,
        emailByCategory: notificationPreferences.emailByCategory,
      })
      .from(notificationPreferences)
      .where(inArray(notificationPreferences.userId, userIds))
    const prefById = new Map(prefRows.map((p) => [p.userId, p.emailByCategory]))

    await Promise.allSettled(
      clean.map((r) => {
        const email = emailById.get(r.userId)
        if (!email) return Promise.resolve()
        // Default on: send unless the user explicitly disabled this category.
        const pref = prefById.get(r.userId)
        if (pref && pref[categoryForType(r.type)] === false) return Promise.resolve()
        return sendNotificationEmail(email, { title: r.title, body: r.body, linkUrl: r.linkUrl })
      })
    )
  } catch (err) {
    consola.error('Notification email delivery failed', err)
  }
}
