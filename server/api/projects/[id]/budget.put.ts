import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectBudgetLines, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { projectBudgetSchema } from '@@/shared/schemas/project'

/** PJ-05 — set the budget lines (category/phase, original vs revised). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, projectBudgetSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    await db.delete(projectBudgetLines).where(eq(projectBudgetLines.projectId, id))
    if (body.lines.length) {
      await db.insert(projectBudgetLines).values(
        body.lines.map((l) => ({
          projectId: id,
          organizationId: ctx.organizationId,
          category: l.category,
          phase: l.phase ?? null,
          originalAmount: String(l.originalAmount),
          revisedAmount: l.revisedAmount != null ? String(l.revisedAmount) : null,
        }))
      )
    }
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving project budget', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
