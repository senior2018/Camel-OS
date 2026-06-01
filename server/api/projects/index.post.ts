import { consola } from 'consola'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createProjectSchema } from '@@/shared/schemas/project'

/**
 * CR-10 — Create a project stub. Until the full project module ships (S13+),
 * this is the only way to seed a project record so donors can be linked.
 * `crm:create` is sufficient since the linking flow lives in the CRM module;
 * we'll raise this to `project:create` when the project module replaces this.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'create')
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

    return { success: true, project: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating project', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
