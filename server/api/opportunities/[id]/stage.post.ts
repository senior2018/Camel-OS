import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateOpportunityStageSchema } from '@@/shared/schemas/opportunity'

/**
 * OM-09: every stage transition is recorded against the opportunity. The audit
 * log captures `{ fromStage, toStage, note }` so the existing /admin/audit-log
 * viewer is the single source of truth for pipeline history — no parallel table
 * needed.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const parsed = updateOpportunityStageSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid stage payload',
      })
    }

    const db = useDrizzle()
    const now = new Date()

    const [existing] = await db
      .select({ id: opportunities.id, stage: opportunities.stage, title: opportunities.title })
      .from(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    if (existing.stage === parsed.data.stage) {
      // No-op — return the current record so the client can stay in sync.
      return { success: true, opportunity: existing, unchanged: true }
    }

    const [updated] = await db
      .update(opportunities)
      .set({ stage: parsed.data.stage, updatedAt: now })
      .where(eq(opportunities.id, existing.id))
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'stage_changed',
      resourceId: existing.id,
      meta: {
        title: existing.title,
        fromStage: existing.stage,
        toStage: parsed.data.stage,
        note: parsed.data.note ?? null,
      },
    })

    return { success: true, opportunity: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating opportunity stage', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
