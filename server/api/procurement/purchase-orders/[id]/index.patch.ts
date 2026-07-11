import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { purchaseOrders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updatePoStatusSchema } from '@@/shared/schemas/procurement'

/** PR-05/06 — advance a PO through its lifecycle. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const b = await readValidatedBody(event, updatePoStatusSchema.parse)
    const set: Record<string, unknown> = { status: b.status }
    if (b.status === 'approved' || b.status === 'committed') set.approvedByUserId = ctx.userId
    const [updated] = await useDrizzle()
      .update(purchaseOrders)
      .set(set)
      .where(and(eq(purchaseOrders.id, id), eq(purchaseOrders.organizationId, ctx.organizationId)))
      .returning({ id: purchaseOrders.id })
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'PO not found' })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating PO', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
