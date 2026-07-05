import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectBudgetLines, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { resolveOrgProjectSettings } from '@@/server/utils/project-settings'
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
      .select({ id: projects.id, budgetRevisionStatus: projects.budgetRevisionStatus })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    // PJ-05 — detect whether the revised budget changed. A changed revision
    // needs a manager's sign-off, so flag it pending; clearing revisions resets.
    const prior = await db
      .select({ revisedAmount: projectBudgetLines.revisedAmount })
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.projectId, id))
    const priorRevised = prior.reduce((s, l) => s + Number(l.revisedAmount ?? 0), 0)
    const newRevised = body.lines.reduce((s, l) => s + (l.revisedAmount ?? 0), 0)

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

    // Only flag a revision for sign-off when the org requires it.
    const settings = await resolveOrgProjectSettings(ctx.organizationId)
    let revisionStatus = project.budgetRevisionStatus
    if (!settings.requireBudgetRevisionApproval) revisionStatus = 'none'
    else if (newRevised === 0) revisionStatus = 'none'
    else if (newRevised !== priorRevised) revisionStatus = 'pending'
    if (revisionStatus !== project.budgetRevisionStatus) {
      await db
        .update(projects)
        .set({ budgetRevisionStatus: revisionStatus, updatedAt: new Date() })
        .where(eq(projects.id, id))
    }
    return { success: true, budgetRevisionStatus: revisionStatus }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving project budget', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
