import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { proposalBrainstormNotes, proposals, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PM-04 — list the brainstorming board notes for a proposal. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const db = useDrizzle()
    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const notes = await db
      .select({
        id: proposalBrainstormNotes.id,
        body: proposalBrainstormNotes.body,
        createdAt: proposalBrainstormNotes.createdAt,
        createdByUserId: proposalBrainstormNotes.createdByUserId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(proposalBrainstormNotes)
      .leftJoin(users, eq(users.id, proposalBrainstormNotes.createdByUserId))
      .where(eq(proposalBrainstormNotes.proposalId, id))
      .orderBy(desc(proposalBrainstormNotes.createdAt))

    return { notes }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing brainstorm notes', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
