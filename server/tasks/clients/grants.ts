import { consola } from 'consola'

import { sendDonorGrantDeadlineReminders } from '@@/server/utils/donor-grants'

/**
 * CR-09 — Daily donor-grant deadline reminder dispatcher. Scheduled via
 * `nitro.scheduledTasks` in nuxt.config.ts; admins can also fire it manually
 * via `POST /api/admin/tasks/donor-grants` for testing.
 */
export default defineTask({
  meta: {
    name: 'clients:grants',
    description: 'Email donor account owners 30 days before each grant deadline (CR-09).',
  },
  async run() {
    consola.info('clients:grants — running')
    const summary = await sendDonorGrantDeadlineReminders()
    consola.info('clients:grants — done', summary)
    return { result: summary }
  },
})
