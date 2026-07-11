import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'

import { timesheetEntries } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { createNotifications } from '@@/server/utils/notifications'
import { requirePermission } from '@@/server/utils/permission-guard'
import { timesheetDecisionSchema } from '@@/shared/schemas/timesheet'

/** TS-03 — approve or return a submitted weekly timesheet. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'timesheet', 'update')
    const body = await readValidatedBody(event, timesheetDecisionSchema.parse)
    const db = useDrizzle()

    const rows = await db
      .select({ id: timesheetEntries.id })
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.organizationId, ctx.organizationId),
          eq(timesheetEntries.userId, body.userId),
          eq(timesheetEntries.weekStartDate, body.weekStart),
          eq(timesheetEntries.status, 'submitted')
        )
      )
    if (!rows.length) {
      throw createError({ statusCode: 404, statusMessage: 'No submitted timesheet for that week.' })
    }

    await db
      .update(timesheetEntries)
      .set({
        status: body.status,
        decisionNote: body.decisionNote ?? null,
        reviewedByUserId: ctx.userId,
        reviewedAt: new Date(),
      })
      .where(
        inArray(
          timesheetEntries.id,
          rows.map((r) => r.id)
        )
      )

    await createNotifications([
      {
        organizationId: ctx.organizationId,
        userId: body.userId,
        type: 'timesheet_decision',
        title: body.status === 'approved' ? 'Timesheet approved' : 'Timesheet returned',
        body: `Your timesheet for the week of ${body.weekStart} was ${body.status === 'approved' ? 'approved' : 'returned for changes'}.`,
        linkUrl: '/timesheets',
      },
    ])
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deciding timesheet', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
