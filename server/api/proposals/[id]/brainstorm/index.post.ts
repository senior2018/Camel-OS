import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalBrainstormNotes, proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { isProposalWriter } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createBrainstormNoteSchema } from '@@/shared/schemas/proposal-brainstorm'

/** PM-04 — add a note to the brainstorming board. Writers only. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const payload = createBrainstormNoteSchema.parse(await readBody(event))
    const db = useDrizzle()

    const [proposal] = await db
      .select({ id: proposals.id })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    if (!(await isProposalWriter(id, ctx.userId, ctx.isSystemAdmin))) {
      throw createError({ statusCode: 403, statusMessage: 'Only the writing team can brainstorm' })
    }

    const [note] = await db
      .insert(proposalBrainstormNotes)
      .values({
        proposalId: id,
        organizationId: ctx.organizationId,
        body: payload.body,
        createdByUserId: ctx.userId,
      })
      .returning()

    return { success: true, note }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding brainstorm note', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
