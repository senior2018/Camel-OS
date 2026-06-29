import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentComments, contentItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'
import { contentCommentSchema } from '@@/shared/schemas/communication'

/** Post a comment on a content item — the author/team and reviewers. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const canComment =
      ctx.isSystemAdmin ||
      (await userHasPermission(ctx.userId, 'communications', 'update')) ||
      (await userHasPermission(ctx.userId, 'communications', 'approve'))
    if (!canComment) throw createError({ statusCode: 403, statusMessage: 'Cannot comment here' })

    const body = await readValidatedBody(event, contentCommentSchema.parse)
    const db = useDrizzle()

    const [item] = await db
      .select({ id: contentItems.id })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Content not found' })

    const [created] = await db
      .insert(contentComments)
      .values({
        contentItemId: id,
        organizationId: ctx.organizationId,
        authorUserId: ctx.userId,
        body: body.body,
      })
      .returning()

    return { success: true, comment: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error posting content comment', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
