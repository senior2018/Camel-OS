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
    const [updated] = await useDrizzle()
      .update(procurementContracts)
      .set({ status: b.status })
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
