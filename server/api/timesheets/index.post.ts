import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { timesheetEntries } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { weekStartOf } from '@@/server/utils/timesheet'
import { timesheetEntrySchema } from '@@/shared/schemas/timesheet'

/** TS-01 — log a daily entry (project activity or internal task). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const body = await readValidatedBody(event, timesheetEntrySchema.parse)
    const weekStart = weekStartOf(body.entryDate)
    const db = useDrizzle()

    // Can't add to a week that's already submitted or approved.
    const existing = await db
      .select({ status: timesheetEntries.status })
      .from(timesheetEntries)
      .where(
        and(eq(timesheetEntries.userId, ctx.userId), eq(timesheetEntries.weekStartDate, weekStart))
      )
    if (existing.some((e) => e.status === 'submitted' || e.status === 'approved')) {
      throw createError({ statusCode: 409, statusMessage: 'This week is locked for editing.' })
    }

    const [created] = await db
      .insert(timesheetEntries)
      .values({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        projectId: body.projectId ?? null,
        activityId: body.activityId ?? null,
        taskLabel: body.taskLabel ?? null,
        entryDate: body.entryDate,
        weekStartDate: weekStart,
        hours: String(body.hours),
        note: body.note ?? null,
        status: 'draft',
      })
      .returning()
    return { success: true, entry: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error logging time', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
