import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { timesheetEntries } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** TS-01 — remove one of my own entries (only while editable). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const db = useDrizzle()

    const [row] = await db
      .select({ status: timesheetEntries.status })
      .from(timesheetEntries)
      .where(and(eq(timesheetEntries.id, id), eq(timesheetEntries.userId, ctx.userId)))
      .limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
    if (row.status === 'submitted' || row.status === 'approved') {
      throw createError({ statusCode: 409, statusMessage: 'This week is locked.' })
    }

    await db.delete(timesheetEntries).where(eq(timesheetEntries.id, id))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting entry', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
