import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { donorProjects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * CR-10 — Unlink a donor from a project. The project itself stays; only the
 * pivot row is removed. Re-linking later starts a fresh funding record.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const donorId = getRouterParam(event, 'id')
    const projectId = getRouterParam(event, 'projectId')
    if (!donorId || !projectId) {
      throw createError({ statusCode: 400, statusMessage: 'Donor + project ids are required' })
    }

    const db = useDrizzle()

    const result = await db
      .delete(donorProjects)
      .where(
        and(
          eq(donorProjects.donorId, donorId),
          eq(donorProjects.projectId, projectId),
          eq(donorProjects.organizationId, ctx.organizationId)
        )
      )
      .returning({ projectId: donorProjects.projectId })

    if (result.length === 0) {
      throw createError({ statusCode: 404, statusMessage: 'Link not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'donor_project_unlinked',
      resourceId: donorId,
      meta: { projectId },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error unlinking donor-project', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
