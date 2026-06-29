import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectVendors } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PJ-08 — remove a vendor. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const vid = getRouterParam(event, 'vid')
    if (!vid) throw createError({ statusCode: 400, statusMessage: 'Vendor ID is required' })
    await useDrizzle()
      .delete(projectVendors)
      .where(and(eq(projectVendors.id, vid), eq(projectVendors.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting vendor', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
