import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalBdNotes, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createBdNoteSchema } from '@@/shared/schemas/proposal-bd-note'

/** S13 (BD-02) — log a client communication or evaluator feedback entry. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const payload = createBdNoteSchema.parse(await readBody(event))
    const db = useDrizzle()

    const [proposal] = await db
      .select({ id: proposals.id, opportunityId: proposals.opportunityId })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const [note] = await db
      .insert(proposalBdNotes)
      .values({
        proposalId: id,
        organizationId: ctx.organizationId,
        kind: payload.kind,
        body: payload.body,
        createdByUserId: ctx.userId,
      })
      .returning()

    await logOpportunityActivity({
      opportunityId: proposal.opportunityId,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      action: 'proposal:bd_note',
      details: { kind: payload.kind },
    })

    return { success: true, note }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error logging BD note', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
