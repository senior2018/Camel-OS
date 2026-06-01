import { consola } from 'consola'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { sendPartnershipRenewalReminders } from '@@/server/utils/partnership-renewals'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Admin-only manual trigger for the partnership renewal reminder task (CR-11).
 * Mirrors the donor-grant trigger; useful for verifying templates and
 * credentials in any environment.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const summary = await sendPartnershipRenewalReminders()
    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'client',
      action: 'agreement_renewals_run',
      resourceId: null,
      meta: { ...summary, triggeredBy: 'manual' },
    })
    return { success: true, summary }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error running partnership renewals', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
