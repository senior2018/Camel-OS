import { consola } from 'consola'

import { requireAdmin } from '@@/server/utils/admin-guard'
import { resolveOrgProposalSettings } from '@@/server/utils/proposal-settings'

/** System-wide proposal settings (admin) — resolved row or shipped defaults. */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const settings = await resolveOrgProposalSettings(admin.organizationId)
    return { settings }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading proposal settings', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
