import { consola } from 'consola'
import { desc, eq, inArray } from 'drizzle-orm'
import {
  deliveryReceipts,
  procurementVendors,
  projects,
  purchaseOrderLines,
  purchaseOrders,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PR-01/06 — purchase orders with vendor, project, lines, and receipt state. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'read')
    const db = useDrizzle()
    const items = await db
      .select({
        id: purchaseOrders.id,
        poNumber: purchaseOrders.poNumber,
        title: purchaseOrders.title,
        amount: purchaseOrders.amount,
        currency: purchaseOrders.currency,
        status: purchaseOrders.status,
        budgetCategory: purchaseOrders.budgetCategory,
        orderedDate: purchaseOrders.orderedDate,
        expectedDate: purchaseOrders.expectedDate,
        vendorId: purchaseOrders.vendorId,
        vendorName: procurementVendors.name,
        projectId: purchaseOrders.projectId,
        projectName: projects.name,
      })
      .from(purchaseOrders)
      .leftJoin(procurementVendors, eq(procurementVendors.id, purchaseOrders.vendorId))
      .leftJoin(projects, eq(projects.id, purchaseOrders.projectId))
      .where(eq(purchaseOrders.organizationId, ctx.organizationId))
      .orderBy(desc(purchaseOrders.createdAt))
    const ids = items.map((p) => p.id)
    const lines = ids.length
      ? await db.select().from(purchaseOrderLines).where(inArray(purchaseOrderLines.poId, ids))
      : []
    const receipts = ids.length
      ? await db
          .select({
            poId: deliveryReceipts.poId,
            receivedDate: deliveryReceipts.receivedDate,
            complete: deliveryReceipts.complete,
          })
          .from(deliveryReceipts)
          .where(inArray(deliveryReceipts.poId, ids))
      : []
    return {
      items: items.map((p) => ({
        ...p,
        lines: lines.filter((l) => l.poId === p.id),
        receipts: receipts.filter((r) => r.poId === p.id),
      })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing POs', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
