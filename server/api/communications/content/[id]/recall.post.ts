import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentComments, contentItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** Recall a content item from review back to draft (author/team). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const db = useDrizzle()
    const [item] = await db
      .select({ id: contentItems.id, status: contentItems.status })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Content not found' })
    if (!['in_review', 'approved'].includes(item.status)) {
      throw createError({ statusCode: 409, statusMessage: 'Nothing to recall.' })
    }

    await db
      .update(contentItems)
      .set({ status: 'draft', updatedAt: new Date() })
      .where(eq(contentItems.id, id))
    await db.insert(contentComments).values({
      contentItemId: id,
      organizationId: ctx.organizationId,
      authorUserId: null,
      body: 'Recalled to draft.',
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error recalling content', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
