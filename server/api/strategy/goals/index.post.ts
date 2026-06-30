import { consola } from 'consola'

import { departmentalGoals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { goalSchema } from '@@/shared/schemas/strategy'

/** ST-02 — create a departmental goal (optionally linked to an objective). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'create')
    const body = await readValidatedBody(event, goalSchema.parse)
    const [created] = await useDrizzle()
      .insert(departmentalGoals)
      .values({
        organizationId: ctx.organizationId,
        objectiveId: body.objectiveId ?? null,
        title: body.title,
        description: body.description ?? null,
        department: body.department ?? null,
        ownerUserId: body.ownerUserId ?? null,
        progressPct: body.progressPct,
        status: body.status,
        dueDate: body.dueDate ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, goal: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating goal', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
