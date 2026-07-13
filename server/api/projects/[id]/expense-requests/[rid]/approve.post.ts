import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectExpenseRequests, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canViewProjectBudget } from '@@/server/utils/project-settings'
import { createNotifications } from '@@/server/utils/notifications'
import { expenseApproveSchema } from '@@/shared/schemas/project'

/** P9 — approve or reject a funds request (PM/lead or finance). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    const rid = getRouterParam(event, 'rid')
    if (!id || !rid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const body = await readValidatedBody(event, expenseApproveSchema.parse)
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
    if (!(await canViewProjectBudget(ctx.userId, ctx.isSystemAdmin, project))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the project manager or finance can approve requests.',
      })
    }

    const [existing] = await db
      .select({
        id: projectExpenseRequests.id,
        status: projectExpenseRequests.status,
        requestedByUserId: projectExpenseRequests.requestedByUserId,
      })
      .from(projectExpenseRequests)
      .where(and(eq(projectExpenseRequests.id, rid), eq(projectExpenseRequests.projectId, id)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
    if (existing.status !== 'requested') {
      throw createError({
        statusCode: 409,
        statusMessage: 'This request has already been decided.',
      })
    }

    await db
      .update(projectExpenseRequests)
      .set({
        status: body.approve ? 'approved' : 'rejected',
        approvedByUserId: ctx.userId,
        approvedAt: new Date(),
        decisionNote: body.note ?? null,
      })
      .where(eq(projectExpenseRequests.id, rid))

    if (existing.requestedByUserId && existing.requestedByUserId !== ctx.userId) {
      await createNotifications([
        {
          organizationId: ctx.organizationId,
          userId: existing.requestedByUserId,
          type: 'project_expense_decided',
          title: `Funds request ${body.approve ? 'approved' : 'rejected'} — ${project.name}`,
          body: body.approve
            ? 'Once paid, return it with the receipt to reconcile the budget.'
            : (body.note ?? 'Your request was rejected.'),
          linkUrl: `/projects/${id}`,
        },
      ])
    }

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deciding expense request', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
