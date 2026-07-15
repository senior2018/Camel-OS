import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { procurementVendors } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createProcVendorSchema } from '@@/shared/schemas/procurement'

/** PR-02 — edit a vendor in the register. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Vendor ID is required' })
    const b = await readValidatedBody(event, createProcVendorSchema.partial().parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: procurementVendors.id })
      .from(procurementVendors)
      .where(
        and(
          eq(procurementVendors.id, id),
          eq(procurementVendors.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Vendor not found' })

    const u: Record<string, unknown> = {}
    if (b.name !== undefined) u.name = b.name
    if (b.category !== undefined) u.category = b.category ?? null
    if (b.contactName !== undefined) u.contactName = b.contactName ?? null
    if (b.contactEmail !== undefined) u.contactEmail = b.contactEmail || null
    if (b.phone !== undefined) u.phone = b.phone ?? null
    if (b.taxId !== undefined) u.taxId = b.taxId ?? null
    if (b.complianceDocUrl !== undefined) u.complianceDocUrl = b.complianceDocUrl || null
    if (b.notes !== undefined) u.notes = b.notes ?? null

    const [updated] = await db
      .update(procurementVendors)
      .set(u)
      .where(eq(procurementVendors.id, id))
      .returning()
    return { success: true, vendor: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating vendor', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
