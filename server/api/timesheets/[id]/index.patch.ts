import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { timesheetEntries } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { timesheetEntrySchema } from '@@/shared/schemas/timesheet'

/** TS-01 — edit a draft timesheet entry (own, unlocked week only). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, timesheetEntrySchema.parse)
    const db = useDrizzle()

    const [entry] = await db
      .select({ status: timesheetEntries.status })
      .from(timesheetEntries)
      .where(and(eq(timesheetEntries.id, id), eq(timesheetEntries.userId, ctx.userId)))
      .limit(1)
    if (!entry) throw createError({ statusCode: 404, statusMessage: 'Entry not found' })
    if (entry.status === 'submitted' || entry.status === 'approved') {
      throw createError({ statusCode: 409, statusMessage: 'This week is locked for editing.' })
    }

    const [updated] = await db
      .update(timesheetEntries)
      .set({
        projectId: body.projectId ?? null,
        activityId: body.activityId ?? null,
        taskLabel: body.taskLabel ?? null,
        entryDate: body.entryDate,
        hours: String(body.hours),
        note: body.note ?? null,
      })
      .where(eq(timesheetEntries.id, id))
      .returning()
    return { success: true, entry: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating time entry', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
