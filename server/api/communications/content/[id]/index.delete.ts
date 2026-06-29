import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/** Delete a content item (cascades reviews + comments). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'delete')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const db = useDrizzle()
    const [existing] = await db
      .select({ id: contentItems.id, title: contentItems.title })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Content not found' })

    await db.delete(contentItems).where(eq(contentItems.id, id))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'delete',
      resourceId: id,
      meta: { title: existing.title },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting content item', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
