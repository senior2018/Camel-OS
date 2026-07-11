import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { deliveryReceipts, purchaseOrders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { receiptSchema } from '@@/shared/schemas/procurement'

/** PR-04 — record a delivery receipt against a PO (marks it received when complete). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const b = await readValidatedBody(event, receiptSchema.parse)
    const db = useDrizzle()
    const [po] = await db
      .select({ id: purchaseOrders.id, status: purchaseOrders.status })
      .from(purchaseOrders)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, ctx.organizationId)))
      .limit(1)
    if (!po) throw createError({ statusCode: 404, statusMessage: 'PO not found' })
    await db.insert(deliveryReceipts).values({
      organizationId: ctx.organizationId,
      poId: id,
      receivedDate: b.receivedDate,
      complete: b.complete,
      note: b.note ?? null,
      receivedByUserId: ctx.userId,
    })
    if (b.complete && ['approved', 'committed'].includes(po.status)) {
      await db.update(purchaseOrders).set({ status: 'received' }).where(eq(purchaseOrders.id, id))
    }
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error recording receipt', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
