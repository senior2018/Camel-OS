import { consola } from 'consola'
import { sendProposalDeadlineReminders } from '@@/server/utils/proposal-reminders'

/**
 * Scheduled daily task that fans out proposal submission-deadline reminders to
 * each proposal's creator + configured recipient list at 2, 7, and 14 days out.
 *
 * Runs on the cron declared in `nuxt.config.ts` (08:00 UTC daily). Admins can
 * also trigger it via `POST /api/admin/tasks/proposal-reminders`.
 */
export default defineTask({
  meta: {
    name: 'proposals:deadline-reminders',
    description: 'Email proposal teams about upcoming submission deadlines',
  },
  async run() {
    const summary = await sendProposalDeadlineReminders()
    consola.info('[proposals:deadline-reminders]', summary)
    return { result: summary }
  },
})
