import { consola } from 'consola'

import { vendorInvoices } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createVendorInvoiceSchema } from '@@/shared/schemas/finance'

/** FN-03 — record a vendor invoice. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'create')
    const body = await readValidatedBody(event, createVendorInvoiceSchema.parse)
    const [created] = await useDrizzle()
      .insert(vendorInvoices)
      .values({
        organizationId: ctx.organizationId,
        vendorName: body.vendorName,
        invoiceNumber: body.invoiceNumber,
        amount: String(body.amount),
        currency: body.currency,
        invoiceDate: body.invoiceDate,
        dueDate: body.dueDate || null,
        poReference: body.poReference ?? null,
        budgetCategory: body.budgetCategory ?? null,
        projectId: body.projectId ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, invoice: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating invoice', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
