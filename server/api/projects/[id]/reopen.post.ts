import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam } from '@@/server/utils/project-settings'
import { logAuditEvent } from '@@/server/utils/audit'

/** P19 — reopen a closed project (undo the archive) so it can be edited again. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const db = useDrizzle()

    const [existing] = await db
      .select({
        id: projects.id,
        closedAt: projects.closedAt,
        projectManagerUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
      })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    if (!(await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, existing))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the project manager or a project leader can reopen this project.',
      })
    }
    if (!existing.closedAt) {
      throw createError({ statusCode: 409, statusMessage: 'Project is not closed.' })
    }

    await db
      .update(projects)
      .set({
        status: 'active',
        closedAt: null,
        closeReason: null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'project',
      action: 'update',
      resourceId: id,
      meta: { event: 'reopened' },
    })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error reopening project', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
