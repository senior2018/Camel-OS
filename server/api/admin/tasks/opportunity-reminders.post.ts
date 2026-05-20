import { consola } from 'consola'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { sendDeadlineReminders } from '@@/server/utils/opportunity-reminders'

/**
 * Admin-only manual trigger for the OM-07 deadline-reminder task. Useful for:
 *  - Local development (no cron host)
 *  - Production debugging (verify reminders go out)
 *  - One-off catch-up runs after downtime
 *
 * The same logic runs from the scheduled Nitro task at 08:00 UTC daily.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)

    const summary = await sendDeadlineReminders()

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'opportunity',
      action: 'deadline_reminders_run',
      meta: { ...summary, triggeredBy: 'manual' },
    })

    return { success: true, summary }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error running opportunity reminders', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
