import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { procurementVendors } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { pgErrorCode } from '@@/server/utils/db-error'

/** PR-02 — remove a vendor from the register. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Vendor ID is required' })
    await useDrizzle()
      .delete(procurementVendors)
      .where(
        and(
          eq(procurementVendors.id, id),
          eq(procurementVendors.organizationId, ctx.organizationId)
        )
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    // Referenced by a PO / contract — don't 500, explain it.
    if (pgErrorCode(error) === '23503') {
      throw createError({
        statusCode: 409,
        statusMessage: 'This vendor is linked to a PO or contract — remove those first.',
      })
    }
    consola.error('Error deleting vendor', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
