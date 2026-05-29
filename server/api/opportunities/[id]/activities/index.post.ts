import { consola } from 'consola'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { opportunities, opportunityStageActivities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

const schema = z.object({
  label: z.string().trim().min(1, 'Label required').max(200),
})

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const oppId = getRouterParam(event, 'id')
    if (!oppId) throw createError({ statusCode: 400, statusMessage: 'Opportunity id required' })

    const parsed = schema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }

    const db = useDrizzle()
    const [opp] = await db
      .select({ id: opportunities.id, stage: opportunities.stage })
      .from(opportunities)
      .where(and(eq(opportunities.id, oppId), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)
    if (!opp) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })

    const [created] = await db
      .insert(opportunityStageActivities)
      .values({
        opportunityId: opp.id,
        organizationId: ctx.organizationId,
        stage: opp.stage,
        label: parsed.data.label,
        sortOrder: 1000, // custom items append to the end
      })
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'activity_added',
      resourceId: opp.id,
      meta: { stage: opp.stage, label: parsed.data.label },
    })

    return { success: true, activity: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding activity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
