import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { leaveRequests } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** HR-03 — cancel my own request (only while still pending). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const db = useDrizzle()

    const [existing] = await db
      .select({ status: leaveRequests.status })
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.userId, ctx.userId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
    if (existing.status !== 'pending') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Only pending requests can be cancelled',
      })
    }

    await db.update(leaveRequests).set({ status: 'cancelled' }).where(eq(leaveRequests.id, id))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error cancelling leave', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
