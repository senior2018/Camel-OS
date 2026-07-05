import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createNotifications } from '@@/server/utils/notifications'
import { canManageProjectTeam } from '@@/server/utils/project-settings'
import { updateProjectSchema } from '@@/shared/schemas/project'

/** Update a project — incl. assigning the Project Manager (PJ-01). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const parsed = updateProjectSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }
    const data = parsed.data
    const db = useDrizzle()

    const [existing] = await db
      .select({
        id: projects.id,
        name: projects.name,
        projectManagerUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
      })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    // Re-assigning the PM is a leadership action — restrict it even though
    // general project edits are open to any project editor.
    const changingPm =
      data.projectManagerUserId !== undefined &&
      (data.projectManagerUserId ?? null) !== existing.projectManagerUserId
    if (changingPm && !(await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, existing))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the project manager or a project leader can reassign the PM.',
      })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.name !== undefined) updates.name = data.name
    if (data.code !== undefined) updates.code = data.code ?? null
    if (data.description !== undefined) updates.description = data.description ?? null
    if (data.scope !== undefined) updates.scope = data.scope ?? null
    if (data.status !== undefined) updates.status = data.status
    if (data.startDate !== undefined) updates.startDate = data.startDate ?? null
    if (data.endDate !== undefined) updates.endDate = data.endDate ?? null
    if (data.totalBudget !== undefined) updates.totalBudget = data.totalBudget ?? null
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.clientId !== undefined) updates.clientId = data.clientId ?? null
    if (data.projectManagerUserId !== undefined)
      updates.projectManagerUserId = data.projectManagerUserId ?? null

    const [updated] = await db.update(projects).set(updates).where(eq(projects.id, id)).returning()

    // PJ-01 — notify a newly-assigned PM.
    const newPm = data.projectManagerUserId
    if (newPm && newPm !== existing.projectManagerUserId && newPm !== ctx.userId) {
      await createNotifications([
        {
          organizationId: ctx.organizationId,
          userId: newPm,
          type: 'project_pm_assigned',
          title: `You're now PM of "${existing.name}"`,
          body: 'You have been assigned as Project Manager.',
          linkUrl: `/projects/${id}`,
        },
      ])
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'project',
      action: 'update',
      resourceId: id,
      meta: { status: updated?.status },
    })

    return { success: true, project: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating project', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
