import { consola } from 'consola'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { sendClientReminders } from '@@/server/utils/client-reminders'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Admin-only manual trigger for the client-reminders scheduled task (CR-05).
 * Useful for verifying credentials and email templates in any env without
 * waiting for the cron window.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const summary = await sendClientReminders()
    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'client',
      action: 'reminders_run',
      resourceId: null,
      meta: { ...summary, triggeredBy: 'manual' },
    })
    return { success: true, summary }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error running client reminders', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
