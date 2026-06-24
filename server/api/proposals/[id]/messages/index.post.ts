import { consola } from 'consola'

import { proposalMessages } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { canAccessProposal } from '@@/server/utils/proposal-conversation'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createProposalMessageSchema } from '@@/shared/schemas/proposal-message'

/** P3 — post a chat message to a proposal's conversation. Members only. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const payload = createProposalMessageSchema.parse(await readBody(event))

    const allowed = await canAccessProposal({
      proposalId: id,
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      isSystemAdmin: ctx.isSystemAdmin,
    })
    if (!allowed)
      throw createError({ statusCode: 403, statusMessage: 'Not a member of this proposal' })

    const db = useDrizzle()
    const [message] = await db
      .insert(proposalMessages)
      .values({
        proposalId: id,
        organizationId: ctx.organizationId,
        kind: 'message',
        body: payload.body,
        authorUserId: ctx.userId,
      })
      .returning()

    return { success: true, message }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error posting proposal message', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
