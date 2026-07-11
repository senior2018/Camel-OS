import { consola } from 'consola'

import { assertCronAuth } from '@@/server/utils/cron-auth'
import { sendDeadlineReminders } from '@@/server/utils/opportunity-reminders'
import { sendProposalDeadlineReminders } from '@@/server/utils/proposal-reminders'
import { sendDonorGrantDeadlineReminders } from '@@/server/utils/donor-grants'
import { sendPartnershipRenewalReminders } from '@@/server/utils/partnership-renewals'
import { sendTimesheetReminders } from '@@/server/utils/timesheet-reminders'

/**
 * Daily reminder fan-out for serverless hosts (Vercel) where the Nitro
 * `scheduledTasks` runner doesn't fire. Wired in `vercel.json` to run at
 * 08:00 UTC. Runs the daily jobs in one request:
 *   - OM-07  opportunity deadline reminders (14/7/2 days out)
 *   - proposal submission deadline reminders (14/7/2 days out)
 *   - CR-09  donor grant deadline reminders (30 days out)
 *   - CR-11  partnership renewal reminders (90 + 30 days out)
 *   - TS-06  timesheet non-submission reminders (Mondays only)
 * Protected by CRON_SECRET (see assertCronAuth).
 */
export default defineEventHandler(async (event) => {
  assertCronAuth(event)
  try {
    const [opportunities, proposalReminders, grants, renewals] = await Promise.all([
      sendDeadlineReminders(),
      sendProposalDeadlineReminders(),
      sendDonorGrantDeadlineReminders(),
      sendPartnershipRenewalReminders(),
    ])
    // TS-06 — weekly, only on Mondays (UTC).
    const timesheets =
      new Date().getUTCDay() === 1 ? await sendTimesheetReminders() : { skipped: true }
    const summary = { opportunities, proposals: proposalReminders, grants, renewals, timesheets }
    consola.info('[cron:daily-reminders]', summary)
    return { success: true, summary }
  } catch (error) {
    consola.error('[cron:daily-reminders] failed', error)
    throw createError({ statusCode: 500, statusMessage: 'Daily reminders failed' })
  }
})
