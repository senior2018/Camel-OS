import { consola } from 'consola'
import { sendDeadlineReminders } from '@@/server/utils/opportunity-reminders'

/**
 * OM-07 — Scheduled daily task that emails opportunity owners about deadlines
 * at 1, 7, and 14 days out.
 *
 * Runs on the cron declared in `nuxt.config.ts` (8:00 UTC daily). For local
 * testing or platform-without-cron deployments, admins can also trigger it via
 * `POST /api/admin/tasks/opportunity-reminders`.
 */
export default defineTask({
  meta: {
    name: 'opportunities:deadline-reminders',
    description: 'Email opportunity owners about upcoming deadlines',
  },
  async run() {
    const summary = await sendDeadlineReminders()
    consola.info('[opportunities:deadline-reminders]', summary)
    return { result: summary }
  },
})
