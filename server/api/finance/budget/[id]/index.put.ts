import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { orgBudgetLines, orgBudgets } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateBudgetSchema } from '@@/shared/schemas/finance'

/** FN-01 — rename / activate / set the lines of a budget. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const body = await readValidatedBody(event, updateBudgetSchema.parse)
    const db = useDrizzle()

    const [budget] = await db
      .select({ id: orgBudgets.id })
      .from(orgBudgets)
      .where(and(eq(orgBudgets.id, id), eq(orgBudgets.organizationId, ctx.organizationId)))
      .limit(1)
    if (!budget) throw createError({ statusCode: 404, statusMessage: 'Budget not found' })

    const set: Record<string, unknown> = { updatedAt: new Date() }
    if (body.name !== undefined) set.name = body.name
    if (body.status !== undefined) set.status = body.status
    await db.update(orgBudgets).set(set).where(eq(orgBudgets.id, id))

    if (body.lines) {
      await db.delete(orgBudgetLines).where(eq(orgBudgetLines.budgetId, id))
      if (body.lines.length) {
        await db.insert(orgBudgetLines).values(
          body.lines.map((l) => ({
            budgetId: id,
            organizationId: ctx.organizationId,
            category: l.category,
            allocatedAmount: String(l.allocatedAmount),
            note: l.note ?? null,
          }))
        )
      }
    }
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating budget', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
