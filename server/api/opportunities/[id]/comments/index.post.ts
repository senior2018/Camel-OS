import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities, opportunityComments } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createOpportunityCommentSchema } from '@@/shared/schemas/opportunity-comment'

/**
 * S7 — Add a comment or owner update to an opportunity's timeline. Both kinds
 * use the same endpoint; the UI flips `kind` based on which composer the user
 * opened.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const parsed = createOpportunityCommentSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid comment payload',
      })
    }

    const db = useDrizzle()
    const [opp] = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)
    if (!opp) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })

    const [created] = await db
      .insert(opportunityComments)
      .values({
        opportunityId: id,
        organizationId: ctx.organizationId,
        kind: parsed.data.kind,
        body: parsed.data.body,
        attachmentUrl: parsed.data.attachmentUrl ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'comment_added',
      resourceId: id,
      meta: { commentId: created?.id, kind: parsed.data.kind },
    })

    return { success: true, comment: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding opportunity comment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
