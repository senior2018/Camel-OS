import { consola } from 'consola'
import { inArray } from 'drizzle-orm'

import {
  notificationPreferences,
  notificationRolePolicy,
  notifications,
  userRoles,
  users,
} from '../database/schema'
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
 * Create one or more notifications: the in-app bell feed (NT-01/03) plus a
 * mirroring email (NT-01) to each recipient whose per-category email preference
 * is on. Delivery is first filtered by the org's role-level policy (NT-02):
 * when an admin has restricted a category to specific roles, recipients whose
 * roles are not in that set are dropped entirely (no in-app, no email). A
 * category with no policy rows is unrestricted (everyone receives).
 * Best-effort throughout — a failure is logged but never blocks the trigger.
 */
export async function createNotifications(rows: NotificationInput[]): Promise<void> {
  let clean = rows.filter((r) => r.userId)
  if (!clean.length) return
  const db = useDrizzle()

  // NT-02 — apply the role-level policy before anything is written.
  try {
    const orgIds = [...new Set(clean.map((r) => r.organizationId))]
    const userIds = [...new Set(clean.map((r) => r.userId))]
    const [policyRows, roleRows] = await Promise.all([
      db
        .select({
          organizationId: notificationRolePolicy.organizationId,
          category: notificationRolePolicy.category,
          roleId: notificationRolePolicy.roleId,
        })
        .from(notificationRolePolicy)
        .where(inArray(notificationRolePolicy.organizationId, orgIds)),
      db
        .select({ userId: userRoles.userId, roleId: userRoles.roleId })
        .from(userRoles)
        .where(inArray(userRoles.userId, userIds)),
    ])
    if (policyRows.length) {
      // orgId -> category -> Set(allowed roleIds)
      const policy = new Map<string, Map<string, Set<string>>>()
      for (const p of policyRows) {
        const byCat = policy.get(p.organizationId) ?? new Map<string, Set<string>>()
        const set = byCat.get(p.category) ?? new Set<string>()
        set.add(p.roleId)
        byCat.set(p.category, set)
        policy.set(p.organizationId, byCat)
      }
      const rolesByUser = new Map<string, Set<string>>()
      for (const r of roleRows) {
        const set = rolesByUser.get(r.userId) ?? new Set<string>()
        set.add(r.roleId)
        rolesByUser.set(r.userId, set)
      }
      clean = clean.filter((r) => {
        const allowed = policy.get(r.organizationId)?.get(categoryForType(r.type))
        if (!allowed || allowed.size === 0) return true // unrestricted category
        const userRoleSet = rolesByUser.get(r.userId)
        if (!userRoleSet) return false
        for (const roleId of userRoleSet) if (allowed.has(roleId)) return true
        return false
      })
    }
  } catch (err) {
    consola.error('Notification policy filtering failed', err)
  }
  if (!clean.length) return

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
