import { consola } from 'consola'

import { sendClientReminders } from '@@/server/utils/client-reminders'

/**
 * CR-05 — Daily client follow-up reminder dispatcher. Scheduled via
 * `nitro.scheduledTasks` in nuxt.config.ts; admins can also fire it manually
 * via `POST /api/admin/tasks/client-reminders` for testing.
 */
export default defineTask({
  meta: {
    name: 'clients:reminders',
    description: 'Email assignees for due client follow-up reminders (CR-05).',
  },
  async run() {
    consola.info('clients:reminders — running')
    const summary = await sendClientReminders()
    consola.info('clients:reminders — done', summary)
    return { result: summary }
  },
})
