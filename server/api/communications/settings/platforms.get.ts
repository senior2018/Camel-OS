import { consola } from 'consola'

import { requirePermission } from '@@/server/utils/permission-guard'
import { resolveOrgCommunicationsSettings } from '@@/server/utils/communications-settings'

/** C2 — the org's configurable platforms + per-platform metrics. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'read')
    return { settings: await resolveOrgCommunicationsSettings(ctx.organizationId) }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading communications settings', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
