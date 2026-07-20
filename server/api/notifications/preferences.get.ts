import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { notificationPreferences } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** NT-02 — the caller's notification preferences (defaults when unset). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const [row] = await useDrizzle()
      .select()
      .from(notificationPreferences)
      .where(eq(notificationPreferences.userId, ctx.userId))
      .limit(1)
    return {
      emailByCategory: row?.emailByCategory ?? {},
      digestFrequency: row?.digestFrequency ?? 'off',
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading preferences', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
