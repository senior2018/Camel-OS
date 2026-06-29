import { consola } from 'consola'
import { and, desc, eq, isNull } from 'drizzle-orm'

import { notifications } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** The signed-in user's notification feed + unread count (header bell). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const db = useDrizzle()

    const items = await db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, ctx.userId))
      .orderBy(desc(notifications.createdAt))
      .limit(30)

    const unread = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)))

    return { items, unreadCount: unread.length }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching notifications', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
