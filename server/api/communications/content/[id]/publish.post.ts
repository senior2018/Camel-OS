import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentComments, contentItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/** Publish an approved content item to the staff library (CC-07 source). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'approve')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const db = useDrizzle()
    const [item] = await db
      .select({ id: contentItems.id, status: contentItems.status })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!item) throw createError({ statusCode: 404, statusMessage: 'Content not found' })
    if (item.status !== 'approved') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Only approved content can be published.',
      })
    }

    await db
      .update(contentItems)
      .set({ status: 'published', publishedAt: new Date(), updatedAt: new Date() })
      .where(eq(contentItems.id, id))

    await db.insert(contentComments).values({
      contentItemId: id,
      organizationId: ctx.organizationId,
      authorUserId: null,
      body: 'Published to the staff library.',
    })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'approve',
      resourceId: id,
      meta: { event: 'published' },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error publishing content', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
