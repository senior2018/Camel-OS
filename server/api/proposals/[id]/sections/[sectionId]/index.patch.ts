import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalSections, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { isProposalWriter } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateProposalSectionSchema } from '@@/shared/schemas/proposal-section'

/** Update a section (title, body, order, section owner). Writers only. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    const sectionId = getRouterParam(event, 'sectionId')
    if (!id || !sectionId) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal and section ID are required' })
    }

    const payload = updateProposalSectionSchema.parse(await readBody(event))
    const db = useDrizzle()

    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    if (!(await isProposalWriter(id, ctx.userId, ctx.isSystemAdmin))) {
      throw createError({ statusCode: 403, statusMessage: 'Only writers can edit sections' })
    }

    const updates: Partial<typeof proposalSections.$inferInsert> = { updatedAt: new Date() }
    if (payload.title !== undefined) updates.title = payload.title
    if (payload.body !== undefined) updates.body = payload.body ?? null
    if (payload.sortOrder !== undefined) updates.sortOrder = payload.sortOrder
    if (payload.assignedToUserId !== undefined) {
      updates.assignedToUserId = payload.assignedToUserId ?? null
    }

    const [updated] = await db
      .update(proposalSections)
      .set(updates)
      .where(and(eq(proposalSections.id, sectionId), eq(proposalSections.proposalId, id)))
      .returning()
    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Section not found' })

    return { success: true, section: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating proposal section', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
