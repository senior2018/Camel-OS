import { consola } from 'consola'
import { and, eq, sql } from 'drizzle-orm'

import {
  expenseClaims,
  orgBudgetLines,
  orgBudgets,
  projectExpenses,
  projects,
  timesheetEntries,
  vendorInvoices,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * FN-04 — expenditure by category + budget-vs-actual; FN-05 — cost-to-project
 * combining project expenses, vendor invoices, expense claims, and labour hours.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'read')
    const db = useDrizzle()

    // Budget-vs-actual for the active/latest budget.
    const [budget] = await db
      .select()
      .from(orgBudgets)
      .where(eq(orgBudgets.organizationId, ctx.organizationId))
      .orderBy(sql`${orgBudgets.status} = 'active' desc`, sql`${orgBudgets.fiscalYear} desc`)
      .limit(1)
    const budgetLines = budget
      ? await db.select().from(orgBudgetLines).where(eq(orgBudgetLines.budgetId, budget.id))
      : []

    const claims = await db
      .select({
        category: expenseClaims.category,
        total: sql<number>`sum(${expenseClaims.amount})::float`,
      })
      .from(expenseClaims)
      .where(
        and(eq(expenseClaims.organizationId, ctx.organizationId), eq(expenseClaims.status, 'paid'))
      )
      .groupBy(expenseClaims.category)
    const invoices = await db
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
    const projExp = await db
      .select({
        category: projectExpenses.category,
        total: sql<number>`sum(${projectExpenses.amount})::float`,
      })
      .from(projectExpenses)
      .where(eq(projectExpenses.organizationId, ctx.organizationId))
      .groupBy(projectExpenses.category)

    const expenditureByCategory: Record<string, number> = {}
    for (const r of [...claims, ...invoices, ...projExp]) {
      const c = r.category ?? 'Uncategorised'
      expenditureByCategory[c] = (expenditureByCategory[c] ?? 0) + Number(r.total ?? 0)
    }
    const budgetVsActual = budgetLines.map((l) => ({
      category: l.category,
      allocated: Number(l.allocatedAmount),
      actual: expenditureByCategory[l.category] ?? 0,
    }))

    // FN-05 — cost per project (expenses + invoices + claims + labour hours).
    const projRows = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.organizationId, ctx.organizationId))
    const pExp = await db
      .select({
        projectId: projectExpenses.projectId,
        total: sql<number>`sum(${projectExpenses.amount})::float`,
      })
      .from(projectExpenses)
      .where(eq(projectExpenses.organizationId, ctx.organizationId))
      .groupBy(projectExpenses.projectId)
    const pInv = await db
      .select({
        projectId: vendorInvoices.projectId,
        total: sql<number>`sum(${vendorInvoices.amount})::float`,
      })
      .from(vendorInvoices)
      .where(eq(vendorInvoices.organizationId, ctx.organizationId))
      .groupBy(vendorInvoices.projectId)
    const pClaim = await db
      .select({
        projectId: expenseClaims.projectId,
        total: sql<number>`sum(${expenseClaims.amount})::float`,
      })
      .from(expenseClaims)
      .where(eq(expenseClaims.organizationId, ctx.organizationId))
      .groupBy(expenseClaims.projectId)
    const pHours = await db
      .select({
        projectId: timesheetEntries.projectId,
        hours: sql<number>`sum(${timesheetEntries.hours})::float`,
      })
      .from(timesheetEntries)
      .where(eq(timesheetEntries.organizationId, ctx.organizationId))
      .groupBy(timesheetEntries.projectId)
    const m = (
      rows: { projectId: string | null; total?: number; hours?: number }[],
      key: 'total' | 'hours'
    ) => {
      const map: Record<string, number> = {}
      for (const r of rows) if (r.projectId) map[r.projectId] = Number(r[key] ?? 0)
      return map
    }
    const exp = m(pExp, 'total')
    const inv = m(pInv, 'total')
    const cl = m(pClaim, 'total')
    const hrs = m(pHours, 'hours')
    const costToProject = projRows
      .map((p) => ({
        projectId: p.id,
        name: p.name,
        expenses: exp[p.id] ?? 0,
        invoices: inv[p.id] ?? 0,
        claims: cl[p.id] ?? 0,
        labourHours: hrs[p.id] ?? 0,
        total: (exp[p.id] ?? 0) + (inv[p.id] ?? 0) + (cl[p.id] ?? 0),
      }))
      .filter((p) => p.total > 0 || p.labourHours > 0)
      .sort((a, b) => b.total - a.total)

    return {
      currency: budget?.currency ?? 'USD',
      expenditureByCategory,
      budgetVsActual,
      costToProject,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building finance reports', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
