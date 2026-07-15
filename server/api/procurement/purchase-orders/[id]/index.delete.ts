import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { purchaseOrders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PR-05 — delete a purchase order (lines/receipts cascade). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'PO ID is required' })
    await useDrizzle()
      .delete(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting PO', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
