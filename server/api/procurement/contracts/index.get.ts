import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'
import { procurementContracts } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PR-08 — contract register. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'read')
    const items = await useDrizzle()
      .select()
      .from(procurementContracts)
      .where(eq(procurementContracts.organizationId, ctx.organizationId))
      .orderBy(desc(procurementContracts.createdAt))
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing contracts', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
