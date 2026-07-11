import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'
import { rfqs } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PR-03 — RFQs with invited vendors + responses. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'read')
    const items = await useDrizzle()
      .select()
      .from(rfqs)
      .where(eq(rfqs.organizationId, ctx.organizationId))
      .orderBy(desc(rfqs.createdAt))
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing RFQs', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
