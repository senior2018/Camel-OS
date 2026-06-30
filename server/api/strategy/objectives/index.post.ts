import { consola } from 'consola'

import { strategicObjectives } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { objectiveSchema } from '@@/shared/schemas/strategy'

/** ST-01 — define an annual strategic objective. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'create')
    const body = await readValidatedBody(event, objectiveSchema.parse)
    const [created] = await useDrizzle()
      .insert(strategicObjectives)
      .values({
        organizationId: ctx.organizationId,
        year: body.year,
        title: body.title,
        description: body.description ?? null,
        theme: body.theme ?? null,
        ownerUserId: body.ownerUserId ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, objective: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating objective', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
