import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectExpenses, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { expenseSchema } from '@@/shared/schemas/project'

/** PJ-07 — record an expense against the project / a budget line. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, expenseSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [created] = await db
      .insert(projectExpenses)
      .values({
        projectId: id,
        organizationId: ctx.organizationId,
        budgetLineId: body.budgetLineId ?? null,
        amount: String(body.amount),
        category: body.category ?? null,
        expenseDate: body.expenseDate,
        description: body.description ?? null,
        receiptUrl: body.receiptUrl ? body.receiptUrl : null,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, expense: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error recording expense', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
