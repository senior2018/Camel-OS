import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

const bodySchema = z.object({ approve: z.boolean(), note: z.string().trim().max(500).nullish() })

/**
 * PJ-05 — sign off (or reject) a pending budget revision. Reserved for a
 * manager / project admin, not the PM who raised it. Approve → the revised
 * budget becomes the working baseline; reject → back to no pending revision.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['project', 'admin'],
      ['admin', 'admin'],
    ])
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, bodySchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id, status: projects.budgetRevisionStatus })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
    if (project.status !== 'pending') {
      throw createError({
        statusCode: 409,
        statusMessage: 'No budget revision is awaiting approval.',
      })
    }

    const next = body.approve ? 'approved' : 'none'
    await db
      .update(projects)
      .set({
        budgetRevisionStatus: next,
        budgetRevisionNote: body.note ?? null,
        updatedAt: new Date(),
      })
      .where(eq(projects.id, id))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'project',
      action: 'update',
      resourceId: id,
      meta: { event: 'budget_revision', decision: next },
    })

    return { success: true, budgetRevisionStatus: next }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error approving budget revision', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
