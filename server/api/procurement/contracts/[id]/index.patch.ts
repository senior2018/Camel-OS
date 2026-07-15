import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { procurementContracts } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateContractSchema } from '@@/shared/schemas/procurement'

/** PR-08 — update a contract's status. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const b = await readValidatedBody(event, updateContractSchema.parse)
    const u: Record<string, unknown> = {}
    if (b.status !== undefined) u.status = b.status
    if (b.title !== undefined) u.title = b.title
    if (b.vendorId !== undefined) u.vendorId = b.vendorId ?? null
    if (b.vendorName !== undefined) u.vendorName = b.vendorName ?? null
    if (b.value !== undefined) u.value = b.value != null ? String(b.value) : null
    if (b.currency !== undefined) u.currency = b.currency
    if (b.startDate !== undefined) u.startDate = b.startDate || null
    if (b.endDate !== undefined) u.endDate = b.endDate || null
    if (b.documentUrl !== undefined) u.documentUrl = b.documentUrl || null
    const [updated] = await useDrizzle()
      .update(procurementContracts)
      .set(u)
      .where(
        and(
          eq(procurementContracts.id, id),
          eq(procurementContracts.organizationId, ctx.organizationId)
        )
      )
      .returning({ id: procurementContracts.id })
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Contract not found' })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating contract', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
