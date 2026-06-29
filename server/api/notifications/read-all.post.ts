import { consola } from 'consola'
import { and, eq, isNull } from 'drizzle-orm'

import { notifications } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** Mark all of the caller's notifications as read. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    await useDrizzle()
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.userId, ctx.userId), isNull(notifications.readAt)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error marking notifications read', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
