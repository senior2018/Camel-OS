import { consola } from 'consola'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createNotifications } from '@@/server/utils/notifications'
import { createProjectSchema } from '@@/shared/schemas/project'

/**
 * Create a project. Used both by the full Project Management module (PJ-01) and
 * by the CRM donor-link picker — hence either `project:create` or `crm:create`.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['project', 'create'],
      ['crm', 'create'],
    ])
    const parsed = createProjectSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid project payload',
      })
    }

    const data = parsed.data
    const db = useDrizzle()

    const [created] = await db
      .insert(projects)
      .values({
        organizationId: ctx.organizationId,
        name: data.name,
        code: data.code ?? null,
        description: data.description ?? null,
        status: data.status,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        totalBudget: data.totalBudget ?? null,
        currency: data.currency,
        scope: data.scope ?? null,
        clientId: data.clientId ?? null,
        projectManagerUserId: data.projectManagerUserId ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    if (!created) throw new Error('Failed to create project')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'project',
      action: 'project_created',
      resourceId: created.id,
      meta: { name: created.name, status: created.status },
    })

    // PJ-01 — the assigned Project Manager is notified of their new project.
    if (created.projectManagerUserId && created.projectManagerUserId !== ctx.userId) {
      await createNotifications([
        {
          organizationId: ctx.organizationId,
          userId: created.projectManagerUserId,
          type: 'project_assigned_pm',
          title: `You're the PM for "${created.name}"`,
          body: 'A new project has been assigned to you.',
          linkUrl: `/projects/${created.id}`,
        },
      ])
    }

    return { success: true, project: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating project', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
