import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities, opportunityStageTransitions } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateOpportunityStageSchema } from '@@/shared/schemas/opportunity'
import { seedActivitiesIfMissing } from '@@/server/utils/opportunity-workflow'

/**
 * S5b — stage transition is now a workflow decision, not just a column flip.
 *
 *   - For 'lost', a `comment` (rejection reason) is REQUIRED — otherwise we
 *     reject the request with 400. This matches the client's spec feedback:
 *     "if rejected then we should add a comment of why".
 *   - For every other transition the comment is optional context.
 *   - We seed the destination stage's default activity checklist if it hasn't
 *     been seeded before, so the modal shows a sensible to-do list on entry.
 *   - We write a row to `opportunity_stage_transitions` capturing the full
 *     decision (from, to, comment, who) — that's the audit-grade record.
 *     The existing audit_log row is preserved for compatibility.
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

    // Spec: rejection requires a reason.
    if (parsed.data.stage === 'lost' && !(parsed.data.note ?? '').trim()) {
      throw createError({
        statusCode: 400,
        statusMessage: 'A rejection reason is required when moving to Lost.',
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
      return { success: true, opportunity: existing, unchanged: true }
    }

    const [updated] = await db
      .update(opportunities)
      .set({ stage: parsed.data.stage, updatedAt: now })
      .where(eq(opportunities.id, existing.id))
      .returning()

    await db.insert(opportunityStageTransitions).values({
      opportunityId: existing.id,
      organizationId: ctx.organizationId,
      fromStage: existing.stage,
      toStage: parsed.data.stage,
      comment: parsed.data.note ?? null,
      userId: ctx.userId,
    })

    await seedActivitiesIfMissing(existing.id, ctx.organizationId, parsed.data.stage)

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
