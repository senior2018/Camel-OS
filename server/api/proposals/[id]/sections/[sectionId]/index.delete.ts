import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalSections, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { isProposalWriter } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'

/** Delete a section. Writers only. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    const sectionId = getRouterParam(event, 'sectionId')
    if (!id || !sectionId) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal and section ID are required' })
    }

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    if (!(await isProposalWriter(id, ctx.userId, ctx.isSystemAdmin))) {
      throw createError({ statusCode: 403, statusMessage: 'Only writers can delete sections' })
    }

    await db
      .delete(proposalSections)
      .where(and(eq(proposalSections.id, sectionId), eq(proposalSections.proposalId, id)))

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting proposal section', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
