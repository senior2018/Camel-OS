import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposalBrainstormNotes } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { isProposalWriter } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PM-04 — remove a brainstorm note. The author or any writer may remove it. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'read')
    const id = getRouterParam(event, 'id')
    const noteId = getRouterParam(event, 'noteId')
    if (!id || !noteId) {
      throw createError({ statusCode: 400, statusMessage: 'Proposal and note IDs are required' })
    }

    const db = useDrizzle()
    const [note] = await db
      .select({ id: proposalBrainstormNotes.id, authorId: proposalBrainstormNotes.createdByUserId })
      .from(proposalBrainstormNotes)
      .where(
        and(
          eq(proposalBrainstormNotes.id, noteId),
          eq(proposalBrainstormNotes.proposalId, id),
          eq(proposalBrainstormNotes.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!note) throw createError({ statusCode: 404, statusMessage: 'Note not found' })

    const isAuthor = note.authorId === ctx.userId
    if (!isAuthor && !(await isProposalWriter(id, ctx.userId, ctx.isSystemAdmin))) {
      throw createError({ statusCode: 403, statusMessage: 'Not allowed to remove this note' })
    }

    await db.delete(proposalBrainstormNotes).where(eq(proposalBrainstormNotes.id, noteId))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting brainstorm note', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
