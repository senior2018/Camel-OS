import { consola } from 'consola'

import { notifications } from '../database/schema'
import { useDrizzle } from './drizzle'

export interface NotificationInput {
  organizationId: string
  userId: string
  type: string
  title: string
  body?: string | null
  linkUrl?: string | null
}

/**
 * Create one or more in-app notifications (the header-bell feed). Best-effort —
 * a failure is logged but never blocks the action that triggered it.
 */
export async function createNotifications(rows: NotificationInput[]): Promise<void> {
  const clean = rows.filter((r) => r.userId)
  if (!clean.length) return
  try {
    await useDrizzle()
      .insert(notifications)
      .values(
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
  }
}
