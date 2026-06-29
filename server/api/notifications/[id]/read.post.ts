import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { notifications } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** Mark a single notification (the caller's own) as read. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Notification ID is required' })

    await useDrizzle()
      .update(notifications)
      .set({ readAt: new Date() })
      .where(and(eq(notifications.id, id), eq(notifications.userId, ctx.userId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error marking notification read', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
