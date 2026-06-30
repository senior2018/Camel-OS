import { consola } from 'consola'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { sendTimesheetReminders } from '@@/server/utils/timesheet-reminders'

/** Admin-only manual trigger for the TS-06 timesheet reminder task. */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const summary = await sendTimesheetReminders()
    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'timesheet',
      action: 'timesheet_reminders_run',
      resourceId: null,
      meta: { ...summary, triggeredBy: 'manual' },
    })
    return { success: true, summary }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error running timesheet reminders', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
