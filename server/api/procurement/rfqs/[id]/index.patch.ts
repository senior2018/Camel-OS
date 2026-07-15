import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { rfqs } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateRfqSchema } from '@@/shared/schemas/procurement'

/** PR-03 — record responses / award / close an RFQ. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const b = await readValidatedBody(event, updateRfqSchema.parse)
    const set: Record<string, unknown> = {}
    if (b.title !== undefined) set.title = b.title
    if (b.description !== undefined) set.description = b.description ?? null
    if (b.dueDate !== undefined) set.dueDate = b.dueDate || null
    if (b.invitedVendors !== undefined) set.invitedVendors = b.invitedVendors
    if (b.status !== undefined) set.status = b.status
    if (b.responses !== undefined) set.responses = b.responses
    if (b.awardedVendor !== undefined) set.awardedVendor = b.awardedVendor ?? null
    const [updated] = await useDrizzle()
      .update(rfqs)
      .set(set)
      .where(and(eq(rfqs.id, id), eq(rfqs.organizationId, ctx.organizationId)))
      .returning({ id: rfqs.id })
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'RFQ not found' })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating RFQ', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
