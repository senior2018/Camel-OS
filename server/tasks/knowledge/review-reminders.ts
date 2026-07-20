import { consola } from 'consola'

import { sendKnowledgeReviewReminders } from '@@/server/utils/knowledge-reminders'

/**
 * KM-06 — alert knowledge managers about articles approaching (or past) their
 * review date. Runs daily 08:00 UTC (see `nuxt.config.ts`). Admins can trigger
 * it via `POST /api/admin/tasks/knowledge-review-reminders`.
 */
export default defineTask({
  meta: {
    name: 'knowledge:review-reminders',
    description: 'Alert knowledge managers about articles due for review',
  },
  async run() {
    const summary = await sendKnowledgeReviewReminders()
    consola.info('[knowledge:review-reminders]', summary)
    return { result: summary }
  },
})
