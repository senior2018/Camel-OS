import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'

import { projects, vendorInvoices } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** FN-03 — vendor invoices with optional PO reference + project. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'read')
    const items = await useDrizzle()
      .select({
        id: vendorInvoices.id,
        vendorName: vendorInvoices.vendorName,
        invoiceNumber: vendorInvoices.invoiceNumber,
        amount: vendorInvoices.amount,
        currency: vendorInvoices.currency,
        invoiceDate: vendorInvoices.invoiceDate,
        dueDate: vendorInvoices.dueDate,
        poReference: vendorInvoices.poReference,
        budgetCategory: vendorInvoices.budgetCategory,
        status: vendorInvoices.status,
        projectId: vendorInvoices.projectId,
        projectName: projects.name,
        createdAt: vendorInvoices.createdAt,
      })
      .from(vendorInvoices)
      .leftJoin(projects, eq(projects.id, vendorInvoices.projectId))
      .where(eq(vendorInvoices.organizationId, ctx.organizationId))
      .orderBy(desc(vendorInvoices.invoiceDate))
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing invoices', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
