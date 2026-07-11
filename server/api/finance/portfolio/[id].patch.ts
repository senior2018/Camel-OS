import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

const bodySchema = z.object({ budgetAlertThreshold: z.number().int().min(1).max(200) })

/** FN-09 — set a project's budget-burn alert threshold (finance). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const body = await readValidatedBody(event, bodySchema.parse)
    const [updated] = await useDrizzle()
      .update(projects)
      .set({ budgetAlertThreshold: body.budgetAlertThreshold, updatedAt: new Date() })
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .returning({ id: projects.id })
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Project not found' })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error setting alert threshold', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
