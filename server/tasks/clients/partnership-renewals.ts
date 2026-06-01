import { consola } from 'consola'

import { sendPartnershipRenewalReminders } from '@@/server/utils/partnership-renewals'

/**
 * CR-11 — Daily partnership-agreement renewal dispatcher. Scheduled via
 * `nitro.scheduledTasks` in nuxt.config.ts; admins can also fire it manually
 * via `POST /api/admin/tasks/partnership-renewals` for testing.
 */
export default defineTask({
  meta: {
    name: 'clients:partnership-renewals',
    description:
      'Email partner-account owners 90 and 30 days before each partnership agreement end date (CR-11).',
  },
  async run() {
    consola.info('clients:partnership-renewals — running')
    const summary = await sendPartnershipRenewalReminders()
    consola.info('clients:partnership-renewals — done', summary)
    return { result: summary }
  },
})
