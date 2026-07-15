import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { rfqs } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PR-03 — delete an RFQ. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'RFQ ID is required' })
    await useDrizzle()
      .delete(rfqs)
      .where(and(eq(rfqs.id, id), eq(rfqs.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting RFQ', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
