import { consola } from 'consola'
import { and, eq, sql } from 'drizzle-orm'

import { proposalSections, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logOpportunityActivity } from '@@/server/utils/opportunity-activity'
import { isProposalWriter } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'
import {
  DEFAULT_PROPOSAL_SECTIONS,
  createProposalSectionSchema,
} from '@@/shared/schemas/proposal-section'

/**
 * Add a section to a proposal. Writers only (Lead + contributors, or admin).
 * Body `{ seedTemplate: true }` (no title) seeds the default section set in one
 * call when the proposal has none yet.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id, opportunityId: proposals.opportunityId })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    if (!(await isProposalWriter(id, ctx.userId, ctx.isSystemAdmin))) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the proposal Lead or a contributor can edit sections',
      })
    }

    const body = await readBody(event)

    // Next sort order = current max + 1.
    const orderRows = await db
      .select({ next: sql<number>`coalesce(max(${proposalSections.sortOrder}), -1) + 1` })
      .from(proposalSections)
      .where(eq(proposalSections.proposalId, id))
    const next = Number(orderRows[0]?.next ?? 0)

    if (body?.seedTemplate === true) {
      const rows = DEFAULT_PROPOSAL_SECTIONS.map((title, i) => ({
        proposalId: id,
        organizationId: ctx.organizationId,
        title,
        sortOrder: Number(next) + i,
        createdByUserId: ctx.userId,
      }))
      const created = await db
        .insert(proposalSections)
        .values(rows)
        .returning({ id: proposalSections.id })
      await logOpportunityActivity({
        opportunityId: proposal.opportunityId,
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        action: 'proposal:sections_seeded',
        details: { count: created.length },
      })
      return { success: true, created: created.length }
    }

    const payload = createProposalSectionSchema.parse(body)
    const [section] = await db
      .insert(proposalSections)
      .values({
        proposalId: id,
        organizationId: ctx.organizationId,
        title: payload.title,
        body: payload.body ?? null,
        assignedToUserId: payload.assignedToUserId ?? null,
        sortOrder: Number(next),
        createdByUserId: ctx.userId,
      })
      .returning()

    return { success: true, section }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating proposal section', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
