import { consola } from 'consola'
import { procurementVendors } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createProcVendorSchema } from '@@/shared/schemas/procurement'

/** PR-02 — add a vendor to the register. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'create')
    const b = await readValidatedBody(event, createProcVendorSchema.parse)
    const [created] = await useDrizzle()
      .insert(procurementVendors)
      .values({
        organizationId: ctx.organizationId,
        name: b.name,
        category: b.category ?? null,
        contactName: b.contactName ?? null,
        contactEmail: b.contactEmail ? b.contactEmail : null,
        phone: b.phone ?? null,
        taxId: b.taxId ?? null,
        complianceDocUrl: b.complianceDocUrl ? b.complianceDocUrl : null,
        notes: b.notes ?? null,
      })
      .returning()
    return { success: true, vendor: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating vendor', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
