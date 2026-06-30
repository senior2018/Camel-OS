import { consola } from 'consola'

import { sendTimesheetReminders } from '@@/server/utils/timesheet-reminders'

/**
 * TS-06 — weekly nudge to staff who didn't submit last week's timesheet.
 * Runs Monday 09:00 UTC (see `nuxt.config.ts`). Admins can trigger it via
 * `POST /api/admin/tasks/timesheet-reminders`.
 */
export default defineTask({
  meta: {
    name: 'hr:timesheet-reminders',
    description: 'Remind staff who have not submitted last week’s timesheet',
  },
  async run() {
    const summary = await sendTimesheetReminders()
    consola.info('[hr:timesheet-reminders]', summary)
    return { result: summary }
  },
})
