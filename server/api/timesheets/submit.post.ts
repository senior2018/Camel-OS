import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'

import { employeeProfiles, timesheetEntries, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { createNotifications } from '@@/server/utils/notifications'
import { requireUser } from '@@/server/utils/permission-guard'
import { weekStartOf } from '@@/server/utils/timesheet'
import { submitWeekSchema } from '@@/shared/schemas/timesheet'

/** TS-02 — submit my week for manager approval. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const body = await readValidatedBody(event, submitWeekSchema.parse)
    const weekStart = weekStartOf(body.weekStart)
    const db = useDrizzle()

    const rows = await db
      .select({ id: timesheetEntries.id })
      .from(timesheetEntries)
      .where(
        and(
          eq(timesheetEntries.userId, ctx.userId),
          eq(timesheetEntries.weekStartDate, weekStart),
          inArray(timesheetEntries.status, ['draft', 'rejected'])
        )
      )
    if (!rows.length) {
      throw createError({ statusCode: 400, statusMessage: 'Nothing to submit for this week.' })
    }

    await db
      .update(timesheetEntries)
      .set({ status: 'submitted', submittedAt: new Date(), decisionNote: null })
      .where(
        inArray(
          timesheetEntries.id,
          rows.map((r) => r.id)
        )
      )

    // Notify the submitter's line manager, if one is recorded.
    const [profile] = await db
      .select({ managerUserId: employeeProfiles.managerUserId })
      .from(employeeProfiles)
      .where(eq(employeeProfiles.userId, ctx.userId))
      .limit(1)
    if (profile?.managerUserId) {
      const [me] = await db
        .select({ firstName: users.firstName, lastName: users.lastName })
        .from(users)
        .where(eq(users.id, ctx.userId))
        .limit(1)
      const who = [me?.firstName, me?.lastName].filter(Boolean).join(' ') || 'A team member'
      await createNotifications([
        {
          organizationId: ctx.organizationId,
          userId: profile.managerUserId,
          type: 'timesheet_submitted',
          title: 'Timesheet awaiting approval',
          body: `${who} submitted their timesheet for the week of ${weekStart}.`,
          linkUrl: '/timesheets/approvals',
        },
      ])
    }
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error submitting timesheet', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
