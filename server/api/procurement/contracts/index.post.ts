import { consola } from 'consola'
import { procurementContracts } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createContractSchema } from '@@/shared/schemas/procurement'

/** PR-08 — add a vendor contract to the register. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'create')
    const b = await readValidatedBody(event, createContractSchema.parse)
    const [created] = await useDrizzle()
      .insert(procurementContracts)
      .values({
        organizationId: ctx.organizationId,
        vendorId: b.vendorId ?? null,
        vendorName: b.vendorName ?? null,
        title: b.title,
        value: b.value != null ? String(b.value) : null,
        currency: b.currency,
        startDate: b.startDate || null,
        endDate: b.endDate || null,
        documentUrl: b.documentUrl ? b.documentUrl : null,
        note: b.note ?? null,
      })
      .returning()
    return { success: true, contract: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating contract', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
