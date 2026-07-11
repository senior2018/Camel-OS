import { consola } from 'consola'
import { purchaseOrderLines, purchaseOrders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createPoSchema } from '@@/shared/schemas/procurement'

/** PR-01 — raise a purchase order with line items. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'create')
    const b = await readValidatedBody(event, createPoSchema.parse)
    const db = useDrizzle()
    const total = b.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
    const [po] = await db
      .insert(purchaseOrders)
      .values({
        organizationId: ctx.organizationId,
        poNumber: b.poNumber,
        vendorId: b.vendorId ?? null,
        title: b.title,
        amount: String(total),
        currency: b.currency,
        budgetCategory: b.budgetCategory ?? null,
        projectId: b.projectId ?? null,
        orderedDate: b.orderedDate || null,
        expectedDate: b.expectedDate || null,
        createdByUserId: ctx.userId,
      })
      .returning()
    if (po) {
      await db.insert(purchaseOrderLines).values(
        b.lines.map((l) => ({
          poId: po.id,
          description: l.description,
          quantity: String(l.quantity),
          unitPrice: String(l.unitPrice),
          amount: String(l.quantity * l.unitPrice),
        }))
      )
    }
    return { success: true, po }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    if ((error as { code?: string })?.code === '23505')
      throw createError({ statusCode: 409, statusMessage: 'That PO number already exists.' })
    consola.error('Error creating PO', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
