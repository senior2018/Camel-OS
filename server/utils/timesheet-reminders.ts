import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'

import { employeeProfiles, timesheetEntries } from '@@/server/database/schema'
import { useDrizzle } from './drizzle'
import { createNotifications } from './notifications'
import { weekStartOf } from './timesheet'

/**
 * TS-06 — remind active staff who haven't submitted last week's timesheet.
 * Designed to run early in the new week (Monday). Idempotency isn't tracked —
 * once a week is submitted the reminder naturally stops; running twice in a day
 * would notify twice, so it's scheduled once per week.
 */
export async function sendTimesheetReminders(
  reference?: Date
): Promise<{ week: string; reminded: number }> {
  const db = useDrizzle()
  const today = (reference ?? new Date()).toISOString().slice(0, 10)
  // The week that just ended = the Monday before this week's Monday.
  const thisMonday = weekStartOf(today)
  const prev = new Date(`${thisMonday}T00:00:00Z`)
  prev.setUTCDate(prev.getUTCDate() - 7)
  const week = prev.toISOString().slice(0, 10)

  const active = await db
    .select({ userId: employeeProfiles.userId, organizationId: employeeProfiles.organizationId })
    .from(employeeProfiles)
    .where(eq(employeeProfiles.status, 'active'))
  if (!active.length) return { week, reminded: 0 }

  const submitted = await db
    .select({ userId: timesheetEntries.userId })
    .from(timesheetEntries)
    .where(
      and(
        eq(timesheetEntries.weekStartDate, week),
        inArray(timesheetEntries.status, ['submitted', 'approved'])
      )
    )
  const submittedIds = new Set(submitted.map((s) => s.userId))

  const targets = active.filter((a) => !submittedIds.has(a.userId))
  await createNotifications(
    targets.map((t) => ({
      organizationId: t.organizationId,
      userId: t.userId,
      type: 'timesheet_reminder',
      title: 'Timesheet not submitted',
      body: `Your timesheet for the week of ${week} hasn't been submitted yet.`,
      linkUrl: '/timesheets',
    }))
  )
  consola.info('[timesheet-reminders]', { week, reminded: targets.length })
  return { week, reminded: targets.length }
}
