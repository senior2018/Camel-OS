import { consola } from 'consola'
import { and, eq, ne, sql } from 'drizzle-orm'

import {
  expenseClaims,
  orgBudgetLines,
  orgBudgets,
  projectBudgetLines,
  projectExpenses,
  projects,
  vendorInvoices,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * FN-06/07/08/10 — portfolio burn dashboard: per-project budget vs spend with
 * burn rate + alert flag, plus an org rolling forecast projected to year-end
 * from the current run-rate against the active budget.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'read')
    const db = useDrizzle()
    const orgId = ctx.organizationId

    const projRows = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        totalBudget: projects.totalBudget,
        currency: projects.currency,
        alertThreshold: projects.budgetAlertThreshold,
      })
      .from(projects)
      .where(and(eq(projects.organizationId, orgId), ne(projects.status, 'cancelled')))

    const budgetLines = await db
      .select({
        projectId: projectBudgetLines.projectId,
        planned: sql<number>`sum(coalesce(${projectBudgetLines.revisedAmount}, ${projectBudgetLines.originalAmount}))::float`,
      })
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.organizationId, orgId))
      .groupBy(projectBudgetLines.projectId)
    const plannedByProj = new Map(budgetLines.map((b) => [b.projectId, Number(b.planned ?? 0)]))

    const sumByProject = async (
      rows: { projectId: string | null; total: number }[]
    ): Promise<Map<string, number>> => {
      const m = new Map<string, number>()
      for (const r of rows)
        if (r.projectId) m.set(r.projectId, (m.get(r.projectId) ?? 0) + Number(r.total ?? 0))
      return m
    }
    const exp = await sumByProject(
      await db
        .select({
          projectId: projectExpenses.projectId,
          total: sql<number>`sum(${projectExpenses.amount})::float`,
        })
        .from(projectExpenses)
        .where(eq(projectExpenses.organizationId, orgId))
        .groupBy(projectExpenses.projectId)
    )
    const inv = await sumByProject(
      await db
        .select({
          projectId: vendorInvoices.projectId,
          total: sql<number>`sum(${vendorInvoices.amount})::float`,
        })
        .from(vendorInvoices)
        .where(eq(vendorInvoices.organizationId, orgId))
        .groupBy(vendorInvoices.projectId)
    )
    const cl = await sumByProject(
      await db
        .select({
          projectId: expenseClaims.projectId,
          total: sql<number>`sum(${expenseClaims.amount})::float`,
        })
        .from(expenseClaims)
        .where(eq(expenseClaims.organizationId, orgId))
        .groupBy(expenseClaims.projectId)
    )

    const portfolio = projRows
      .map((p) => {
        const budget = plannedByProj.get(p.id) || Number(p.totalBudget ?? 0)
        const spent = (exp.get(p.id) ?? 0) + (inv.get(p.id) ?? 0) + (cl.get(p.id) ?? 0)
        const burn = budget ? Math.round((spent / budget) * 100) : 0
        return {
          projectId: p.id,
          name: p.name,
          status: p.status,
          currency: p.currency,
          budget,
          spent,
          burn,
          alertThreshold: p.alertThreshold,
          overThreshold: budget > 0 && burn >= p.alertThreshold,
          rag: burn > 100 ? 'error' : burn >= p.alertThreshold ? 'warning' : 'success',
        }
      })
      .sort((a, b) => b.burn - a.burn)

    // Org rolling forecast (FN-06): annualise current spend by run-rate.
    const [budget] = await db
      .select()
      .from(orgBudgets)
      .where(eq(orgBudgets.organizationId, orgId))
      .orderBy(sql`${orgBudgets.status} = 'active' desc`, sql`${orgBudgets.fiscalYear} desc`)
      .limit(1)
    let allocated = 0
    if (budget) {
      const [row] = await db
        .select({ total: sql<number>`sum(${orgBudgetLines.allocatedAmount})::float` })
        .from(orgBudgetLines)
        .where(eq(orgBudgetLines.budgetId, budget.id))
      allocated = Number(row?.total ?? 0)
    }
    const totalSpent = portfolio.reduce((s, p) => s + p.spent, 0)
    const monthsElapsed = Math.max(1, new Date().getMonth() + 1) // Jan=1
    const forecastYearEnd = Math.round((totalSpent / monthsElapsed) * 12)

    return {
      currency: budget?.currency ?? 'USD',
      portfolio,
      forecast: {
        allocated,
        spentToDate: totalSpent,
        monthsElapsed,
        forecastYearEnd,
        overBudget: allocated > 0 && forecastYearEnd > allocated,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building portfolio', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
