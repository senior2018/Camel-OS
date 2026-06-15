import { consola } from 'consola'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { sendProposalDeadlineReminders } from '@@/server/utils/proposal-reminders'

/**
 * Admin-only manual trigger for the proposal deadline-reminder dispatcher.
 * The same logic runs from the scheduled Nitro task at 08:00 UTC daily.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)

    const summary = await sendProposalDeadlineReminders()

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'proposal',
      action: 'deadline_reminders_run',
      meta: { ...summary, triggeredBy: 'manual' },
    })

    return { success: true, summary }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error running proposal reminders', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
