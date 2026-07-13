import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectExpenseRequests, projectExpenses, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canViewProjectBudget } from '@@/server/utils/project-settings'
import { createNotifications } from '@@/server/utils/notifications'
import { expenseReturnSchema } from '@@/shared/schemas/project'

/**
 * P9 — "return" an approved request: record what was actually spent + the
 * receipt. This posts an actual expense to the budget ledger so budgeting
 * reflects real spend, and closes the request as returned.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    const rid = getRouterParam(event, 'rid')
    if (!id || !rid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const body = await readValidatedBody(event, expenseReturnSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        projectManagerUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
      })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [existing] = await db
      .select({
        id: projectExpenseRequests.id,
        status: projectExpenseRequests.status,
        purpose: projectExpenseRequests.purpose,
        category: projectExpenseRequests.category,
        requestedByUserId: projectExpenseRequests.requestedByUserId,
      })
      .from(projectExpenseRequests)
      .where(and(eq(projectExpenseRequests.id, rid), eq(projectExpenseRequests.projectId, id)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Request not found' })

    // The requester returns their own; a lead/finance can also reconcile.
    const privileged = await canViewProjectBudget(ctx.userId, ctx.isSystemAdmin, project)
    if (existing.requestedByUserId !== ctx.userId && !privileged) {
      throw createError({ statusCode: 403, statusMessage: 'Only the requester can return this.' })
    }
    if (existing.status !== 'approved') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Only approved requests can be returned.',
      })
    }
    if (!body.receiptUrl) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A receipt / proof of payment is required.',
      })
    }

    const now = new Date()
    await db
      .update(projectExpenseRequests)
      .set({
        status: 'returned',
        spentAmount: String(body.spentAmount),
        receiptUrl: body.receiptUrl,
        returnNote: body.returnNote ?? null,
        returnedAt: now,
      })
      .where(eq(projectExpenseRequests.id, rid))

    // Post the actual spend to the budget ledger.
    await db.insert(projectExpenses).values({
      projectId: id,
      organizationId: ctx.organizationId,
      amount: String(body.spentAmount),
      category: existing.category ?? null,
      expenseDate: now.toISOString().slice(0, 10),
      description: existing.purpose,
      receiptUrl: body.receiptUrl,
      createdByUserId: ctx.userId,
    })

    if (project.projectManagerUserId && project.projectManagerUserId !== ctx.userId) {
      await createNotifications([
        {
          organizationId: ctx.organizationId,
          userId: project.projectManagerUserId,
          type: 'project_expense_returned',
          title: `Expense returned — ${project.name}`,
          body: `${existing.purpose} · spent ${body.spentAmount}`,
          linkUrl: `/projects/${id}`,
        },
      ])
    }

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error returning expense request', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
