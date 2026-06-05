import { consola } from 'consola'
import { eq } from 'drizzle-orm'

import {
  opportunityDecisions,
  opportunities,
  proposals,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit-log'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createOpportunityDecisionSchema } from '@@/shared/schemas/opportunity-decision'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')

    if (!id) {
      throw createError({ statusCode: 400, statusMessage: 'Opportunity ID is required' })
    }

    const body = await readBody(event)
    const payload = createOpportunityDecisionSchema.parse(body)

    const db = useDrizzle()

    // Check if opportunity exists and belongs to this org
    const [opportunity] = await db
      .select()
      .from(opportunities)
      .where(eq(opportunities.id, id))
      .limit(1)

    if (!opportunity) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    if (opportunity.organizationId !== ctx.organizationId) {
      throw createError({ statusCode: 403, statusMessage: 'Access denied' })
    }

    // Check if decision already exists
    const [existingDecision] = await db
      .select()
      .from(opportunityDecisions)
      .where(eq(opportunityDecisions.opportunityId, id))
      .limit(1)

    let decision
    if (existingDecision) {
      // Update existing decision
      ;[decision] = await db
        .update(opportunityDecisions)
        .set({
          status: payload.status,
          decisionReason: payload.decisionReason,
          decidedByUserId: ctx.userId,
          decidedAt: new Date(),
        })
        .where(eq(opportunityDecisions.id, existingDecision.id))
        .returning()
    } else {
      // Create new decision
      ;[decision] = await db
        .insert(opportunityDecisions)
        .values({
          opportunityId: id,
          organizationId: ctx.organizationId,
          status: payload.status,
          decisionReason: payload.decisionReason,
          decidedByUserId: ctx.userId,
          decidedAt: new Date(),
        })
        .returning()
    }

    // If approved, create proposal (if not already created)
    if (payload.status === 'approved') {
      const [existingProposal] = await db
        .select()
        .from(proposals)
        .where(eq(proposals.opportunityId, id))
        .limit(1)

      if (!existingProposal) {
        await db.insert(proposals).values({
          opportunityId: id,
          organizationId: ctx.organizationId,
          title: opportunity.title,
          status: 'assigned',
          createdByUserId: ctx.userId,
        })
      }
    }

    // Log audit event
    await logAuditEvent({
      event,
      action: 'opportunity:decision',
      details: {
        opportunityId: id,
        decision: payload.status,
        reason: payload.decisionReason,
      },
    })

    return {
      success: true,
      decision,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error making opportunity decision', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
