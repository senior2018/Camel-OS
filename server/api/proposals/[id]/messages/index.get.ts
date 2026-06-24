import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { proposalMessages, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { canAccessProposal } from '@@/server/utils/proposal-conversation'
import { requirePermission } from '@@/server/utils/permission-guard'

/** P3 — the proposal conversation: chat + auto-posted workflow events, oldest first. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const allowed = await canAccessProposal({
      proposalId: id,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      isSystemAdmin: ctx.isSystemAdmin,
    })
    if (!allowed) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const db = useDrizzle()
    const messages = await db
      .select({
        id: proposalMessages.id,
        kind: proposalMessages.kind,
        body: proposalMessages.body,
        eventType: proposalMessages.eventType,
        createdAt: proposalMessages.createdAt,
        authorUserId: proposalMessages.authorUserId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(proposalMessages)
      .leftJoin(users, eq(users.id, proposalMessages.authorUserId))
      .where(eq(proposalMessages.proposalId, id))
      .orderBy(asc(proposalMessages.createdAt))

    return { messages }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing proposal messages', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
