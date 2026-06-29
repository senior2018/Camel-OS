import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { stakeholderActivities, stakeholders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { stakeholderActivitySchema } from '@@/shared/schemas/communication'

/** CC-16 — log an engagement activity against a stakeholder. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, stakeholderActivitySchema.parse)
    const db = useDrizzle()

    const [s] = await db
      .select({ id: stakeholders.id })
      .from(stakeholders)
      .where(and(eq(stakeholders.id, id), eq(stakeholders.organizationId, ctx.organizationId)))
      .limit(1)
    if (!s) throw createError({ statusCode: 404, statusMessage: 'Stakeholder not found' })

    await db.insert(stakeholderActivities).values({
      stakeholderId: id,
      organizationId: ctx.organizationId,
      activityDate: body.activityDate,
      type: body.type,
      description: body.description ?? null,
      outcome: body.outcome ?? null,
      nextStep: body.nextStep ?? null,
      loggedByUserId: ctx.userId,
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error logging activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
