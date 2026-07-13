import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectExpenses } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { expenseSchema } from '@@/shared/schemas/project'

/** PJ-07 — edit an expense (Finance Officer or PM). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['project', 'update'],
      ['finance', 'create'],
      ['finance', 'update'],
    ])
    const eid = getRouterParam(event, 'eid')
    if (!eid) throw createError({ statusCode: 400, statusMessage: 'Expense ID is required' })
    const data = await readValidatedBody(event, expenseSchema.partial().parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: projectExpenses.id })
      .from(projectExpenses)
      .where(
        and(eq(projectExpenses.id, eid), eq(projectExpenses.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Expense not found' })

    const updates: Record<string, unknown> = {}
    if (data.amount !== undefined) updates.amount = String(data.amount)
    if (data.category !== undefined) updates.category = data.category ?? null
    if (data.budgetLineId !== undefined) updates.budgetLineId = data.budgetLineId ?? null
    if (data.expenseDate !== undefined) updates.expenseDate = data.expenseDate
    if (data.description !== undefined) updates.description = data.description ?? null
    if (data.receiptUrl !== undefined) updates.receiptUrl = data.receiptUrl || null

    const [updated] = await db
      .update(projectExpenses)
      .set(updates)
      .where(eq(projectExpenses.id, eid))
      .returning()
    return { success: true, expense: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating expense', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
