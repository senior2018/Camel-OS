import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { vendorInvoices } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateVendorInvoiceSchema } from '@@/shared/schemas/finance'

/** FN-03 — advance an invoice's payment status. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const body = await readValidatedBody(event, updateVendorInvoiceSchema.parse)
    const [updated] = await useDrizzle()
      .update(vendorInvoices)
      .set({ status: body.status, paidAt: body.status === 'paid' ? new Date() : null })
      .where(and(eq(vendorInvoices.id, id), eq(vendorInvoices.organizationId, ctx.organizationId)))
      .returning()
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Invoice not found' })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating invoice', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
