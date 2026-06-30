import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { projects, timesheetEntries } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { weekStartOf } from '@@/server/utils/timesheet'

/** TS-01/02 — my entries for a given week + the week's roll-up status. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const q = getQuery(event)
    const today = new Date().toISOString().slice(0, 10)
    const weekStart = weekStartOf(String(q.weekStart ?? today))
    const db = useDrizzle()

    const rows = await db
      .select({
        id: timesheetEntries.id,
        entryDate: timesheetEntries.entryDate,
        hours: timesheetEntries.hours,
        projectId: timesheetEntries.projectId,
        projectName: projects.name,
        activityId: timesheetEntries.activityId,
        taskLabel: timesheetEntries.taskLabel,
        note: timesheetEntries.note,
        status: timesheetEntries.status,
        decisionNote: timesheetEntries.decisionNote,
      })
      .from(timesheetEntries)
      .leftJoin(projects, eq(projects.id, timesheetEntries.projectId))
      .where(
        and(eq(timesheetEntries.userId, ctx.userId), eq(timesheetEntries.weekStartDate, weekStart))
      )
      .orderBy(asc(timesheetEntries.entryDate))

    const total = rows.reduce((s, r) => s + Number(r.hours), 0)
    // Week status = the "strongest" state present (approved > submitted > rejected > draft).
    const order = ['approved', 'submitted', 'rejected', 'draft'] as const
    const weekStatus = order.find((st) => rows.some((r) => r.status === st)) ?? 'draft'
    const locked = weekStatus === 'submitted' || weekStatus === 'approved'

    return { weekStart, entries: rows, total, weekStatus, locked }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading timesheet', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
