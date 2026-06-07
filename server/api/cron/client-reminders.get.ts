import { consola } from 'consola'

import { assertCronAuth } from '@@/server/utils/cron-auth'
import { sendClientReminders } from '@@/server/utils/client-reminders'

/**
 * CR-05 — client follow-up reminders. On an always-on host this runs every few
 * minutes via Nitro; on Vercel it's driven by `vercel.json` (hourly by default;
 * tighten on a Pro plan). `notified_at` stamping guarantees each reminder fires
 * exactly once regardless of cadence. Protected by CRON_SECRET.
 */
export default defineEventHandler(async (event) => {
  assertCronAuth(event)
  try {
    const summary = await sendClientReminders()
    consola.info('[cron:client-reminders]', summary)
    return { success: true, summary }
  } catch (error) {
    consola.error('[cron:client-reminders] failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Client reminders failed' })
  }
})
