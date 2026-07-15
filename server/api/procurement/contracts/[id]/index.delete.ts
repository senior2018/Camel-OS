import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { procurementContracts } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PR-07 — delete a contract from the register. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Contract ID is required' })
    await useDrizzle()
      .delete(procurementContracts)
      .where(
        and(
          eq(procurementContracts.id, id),
          eq(procurementContracts.organizationId, ctx.organizationId)
        )
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting contract', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
