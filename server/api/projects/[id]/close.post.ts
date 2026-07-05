import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { resolveOrgProjectSettings } from '@@/server/utils/project-settings'
import { logAuditEvent } from '@@/server/utils/audit'
import { closeProjectSchema } from '@@/shared/schemas/project'

/** PJ-11 — close + archive a project once the sign-off checklist is complete. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, closeProjectSchema.parse)
    const db = useDrizzle()

    const settings = await resolveOrgProjectSettings(ctx.organizationId)
    const incomplete = settings.closeChecklist.filter((item) => !body.checklist[item])
    if (incomplete.length) {
      throw createError({
        statusCode: 400,
        statusMessage: `Complete the sign-off checklist first (${incomplete.length} item${incomplete.length === 1 ? '' : 's'} remaining).`,
      })
    }

    const [existing] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    await db
      .update(projects)
      .set({
        status: 'completed',
        closedAt: new Date(),
        closeChecklist: body.checklist,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'project',
      action: 'update',
      resourceId: id,
      meta: { event: 'closed' },
    })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error closing project', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
