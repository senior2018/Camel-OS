import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectExpenseRequests, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam, isProjectMember } from '@@/server/utils/project-settings'
import { createNotifications } from '@@/server/utils/notifications'
import { expenseRequestSchema } from '@@/shared/schemas/project'

/** P9 — raise a request for funds (goes to approval, then return/reconcile). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, expenseRequestSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        projectManagerUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
        closedAt: projects.closedAt,
      })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
    if (project.closedAt)
      throw createError({ statusCode: 409, statusMessage: 'Project is closed.' })

    const isLead = await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, project)
    if (!isLead && !(await isProjectMember(ctx.userId, id))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only project members can request funds.',
      })
    }

    const [created] = await db
      .insert(projectExpenseRequests)
      .values({
        projectId: id,
        organizationId: ctx.organizationId,
        purpose: body.purpose,
        category: body.category ?? null,
        amount: String(body.amount),
        status: 'requested',
        requestedByUserId: ctx.userId,
      })
      .returning()

    if (project.projectManagerUserId && project.projectManagerUserId !== ctx.userId) {
      await createNotifications([
        {
          organizationId: ctx.organizationId,
          userId: project.projectManagerUserId,
          type: 'project_expense_requested',
          title: `Funds requested — ${project.name}`,
          body: `${body.purpose} · ${body.amount}`,
          linkUrl: `/projects/${id}`,
        },
      ])
    }

    return { success: true, request: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating expense request', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
