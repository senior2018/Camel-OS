import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectExpenses } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PJ-07 — remove an expense. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const eid = getRouterParam(event, 'eid')
    if (!eid) throw createError({ statusCode: 400, statusMessage: 'Expense ID is required' })
    await useDrizzle()
      .delete(projectExpenses)
      .where(
        and(eq(projectExpenses.id, eid), eq(projectExpenses.organizationId, ctx.organizationId))
      )
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting expense', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
