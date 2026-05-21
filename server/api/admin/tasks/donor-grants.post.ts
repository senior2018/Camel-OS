import { consola } from 'consola'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { sendDonorGrantDeadlineReminders } from '@@/server/utils/donor-grants'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Admin-only manual trigger for the donor-grant deadline reminder task (CR-09).
 * Useful for verifying templates and credentials in any environment.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const summary = await sendDonorGrantDeadlineReminders()
    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'client',
      action: 'grant_deadlines_run',
      resourceId: null,
      meta: { ...summary, triggeredBy: 'manual' },
    })
    return { success: true, summary }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error running donor-grant deadlines', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
