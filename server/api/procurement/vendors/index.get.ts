import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'
import { procurementVendors } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PR-02 — vendor register. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'read')
    const items = await useDrizzle()
      .select()
      .from(procurementVendors)
      .where(eq(procurementVendors.organizationId, ctx.organizationId))
      .orderBy(asc(procurementVendors.name))
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing vendors', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
