import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectVendors } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { vendorSchema } from '@@/shared/schemas/project'

/** PJ-08 — edit a vendor. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const vid = getRouterParam(event, 'vid')
    if (!vid) throw createError({ statusCode: 400, statusMessage: 'Vendor ID is required' })
    const data = await readValidatedBody(event, vendorSchema.partial().parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: projectVendors.id })
      .from(projectVendors)
      .where(and(eq(projectVendors.id, vid), eq(projectVendors.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Vendor not found' })

    const updates: Record<string, unknown> = {}
    if (data.name !== undefined) updates.name = data.name
    if (data.contactName !== undefined) updates.contactName = data.contactName ?? null
    if (data.contactEmail !== undefined) updates.contactEmail = data.contactEmail || null
    if (data.contractAmount !== undefined)
      updates.contractAmount = data.contractAmount != null ? String(data.contractAmount) : null
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.scope !== undefined) updates.scope = data.scope ?? null
    if (data.paymentSchedule !== undefined) updates.paymentSchedule = data.paymentSchedule ?? null
    if (data.budgetCategory !== undefined) updates.budgetCategory = data.budgetCategory ?? null

    const [updated] = await db
      .update(projectVendors)
      .set(updates)
      .where(eq(projectVendors.id, vid))
      .returning()
    return { success: true, vendor: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating vendor', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
