import { consola } from 'consola'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { procurementContracts, purchaseOrders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PR-07 — procurement dashboard: PO counts by status, committed value, contracts expiring. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'read')
    const db = useDrizzle()
    const byStatus = await db
      .select({
        status: purchaseOrders.status,
        count: sql<number>`count(*)::int`,
        value: sql<number>`sum(${purchaseOrders.amount})::float`,
      })
      .from(purchaseOrders)
      .where(eq(purchaseOrders.organizationId, ctx.organizationId))
      .groupBy(purchaseOrders.status)
    // PR-05 — committed + received POs represent finance commitments.
    const [committed] = await db
      .select({ total: sql<number>`sum(${purchaseOrders.amount})::float` })
      .from(purchaseOrders)
      .where(
        and(
          eq(purchaseOrders.organizationId, ctx.organizationId),
          inArray(purchaseOrders.status, ['committed', 'received'])
        )
      )
    const [activeContracts] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(procurementContracts)
      .where(
        and(
          eq(procurementContracts.organizationId, ctx.organizationId),
          eq(procurementContracts.status, 'active')
        )
      )
    return {
      byStatus,
      committedValue: Number(committed?.total ?? 0),
      activeContracts: Number(activeContracts?.count ?? 0),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building procurement dashboard', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
