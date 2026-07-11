import { consola } from 'consola'
import { and, desc, eq, sql } from 'drizzle-orm'

import {
  expenseClaims,
  orgBudgetLines,
  orgBudgets,
  projectExpenses,
  vendorInvoices,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * FN-01/FN-04 — the org's budgets plus, for the active (or latest) one, its
 * lines with actual spend per category (paid expense claims + paid vendor
 * invoices + project expenses), so the UI renders budget-vs-actual directly.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'read')
    const db = useDrizzle()

    const budgets = await db
      .select()
      .from(orgBudgets)
      .where(eq(orgBudgets.organizationId, ctx.organizationId))
      .orderBy(desc(orgBudgets.fiscalYear))

    const selectedId =
      (getQuery(event).budgetId as string) ||
      budgets.find((b) => b.status === 'active')?.id ||
      budgets[0]?.id
    let lines: { id: string; category: string; allocatedAmount: string; note: string | null }[] = []
    const actualByCategory: Record<string, number> = {}

    if (selectedId) {
      lines = await db
        .select({
          id: orgBudgetLines.id,
          category: orgBudgetLines.category,
          allocatedAmount: orgBudgetLines.allocatedAmount,
          note: orgBudgetLines.note,
        })
        .from(orgBudgetLines)
        .where(eq(orgBudgetLines.budgetId, selectedId))

      // Actuals: paid claims + paid vendor invoices (+ all project expenses),
      // grouped by their budget category.
      const claimRows = await db
        .select({
          category: expenseClaims.category,
          total: sql<number>`sum(${expenseClaims.amount})::float`,
        })
        .from(expenseClaims)
        .where(
          and(
            eq(expenseClaims.organizationId, ctx.organizationId),
            eq(expenseClaims.status, 'paid')
          )
        )
        .groupBy(expenseClaims.category)
      const invRows = await db
        .select({
          category: vendorInvoices.budgetCategory,
          total: sql<number>`sum(${vendorInvoices.amount})::float`,
        })
        .from(vendorInvoices)
        .where(
          and(
            eq(vendorInvoices.organizationId, ctx.organizationId),
            eq(vendorInvoices.status, 'paid')
          )
        )
        .groupBy(vendorInvoices.budgetCategory)
      const projRows = await db
        .select({
          category: projectExpenses.category,
          total: sql<number>`sum(${projectExpenses.amount})::float`,
        })
        .from(projectExpenses)
        .where(eq(projectExpenses.organizationId, ctx.organizationId))
        .groupBy(projectExpenses.category)
      for (const r of [...claimRows, ...invRows, ...projRows]) {
        const cat = r.category ?? 'Uncategorised'
        actualByCategory[cat] = (actualByCategory[cat] ?? 0) + Number(r.total ?? 0)
      }
    }

    return { budgets, selectedId: selectedId ?? null, lines, actualByCategory }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading budget', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
