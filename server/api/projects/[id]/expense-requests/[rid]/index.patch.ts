import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectExpenseRequests, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam } from '@@/server/utils/project-settings'
import { expenseRequestSchema } from '@@/shared/schemas/project'

/** P9 — edit a funds request while it's still pending (requester or lead). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    const rid = getRouterParam(event, 'rid')
    if (!id || !rid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const data = await readValidatedBody(event, expenseRequestSchema.partial().parse)
    const db = useDrizzle()

    const [row] = await db
      .select({
        request: projectExpenseRequests,
        pmUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
      })
      .from(projectExpenseRequests)
      .innerJoin(projects, eq(projects.id, projectExpenseRequests.projectId))
      .where(and(eq(projectExpenseRequests.id, rid), eq(projectExpenseRequests.projectId, id)))
      .limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Request not found' })
    if (row.request.status !== 'requested') {
      throw createError({ statusCode: 409, statusMessage: 'Only a pending request can be edited.' })
    }
    const isLead = await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, {
      projectManagerUserId: row.pmUserId,
      createdByUserId: row.createdByUserId,
    })
    if (row.request.requestedByUserId !== ctx.userId && !isLead) {
      throw createError({ statusCode: 403, statusMessage: 'Only the requester can edit this.' })
    }

    const updates: Record<string, unknown> = {}
    if (data.purpose !== undefined) updates.purpose = data.purpose
    if (data.category !== undefined) updates.category = data.category ?? null
    if (data.amount !== undefined) updates.amount = String(data.amount)

    const [updated] = await db
      .update(projectExpenseRequests)
      .set(updates)
      .where(eq(projectExpenseRequests.id, rid))
      .returning()
    return { success: true, request: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error editing expense request', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
