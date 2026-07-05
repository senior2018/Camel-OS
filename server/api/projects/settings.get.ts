import { consola } from 'consola'

import { requirePermission } from '@@/server/utils/permission-guard'
import { resolveOrgProjectSettings } from '@@/server/utils/project-settings'

/**
 * The org's effective project settings (resolved row or shipped defaults).
 * Readable by any project-team member so the module's pickers reflect them; it
 * is only editable by an admin or a project leader on the Settings page.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    return { settings: await resolveOrgProjectSettings(ctx.organizationId) }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading project settings', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
