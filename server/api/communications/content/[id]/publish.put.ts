import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { contentPublishSchema } from '@@/shared/schemas/communication-settings'

/**
 * C1/C2 — record where a piece was published (platform + live link) and its
 * performance (paid/free + spend + platform metrics). Only meaningful once the
 * item is approved/published, so we require that state.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })
    const data = await readValidatedBody(event, contentPublishSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: contentItems.id, status: contentItems.status })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Content not found' })
    if (existing.status !== 'approved' && existing.status !== 'published') {
      throw createError({
        statusCode: 409,
        statusMessage: 'Approve the content before recording where it was published.',
      })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.platform !== undefined) updates.platform = data.platform ?? null
    if (data.publishedUrl !== undefined) updates.publishedUrl = data.publishedUrl || null
    if (data.isPaid !== undefined) updates.isPaid = data.isPaid
    if (data.spend !== undefined) updates.spend = String(data.spend)
    if (data.metrics !== undefined) updates.metrics = data.metrics
    // Recording a live link marks it published.
    if (data.publishedUrl && existing.status === 'approved') {
      updates.status = 'published'
      updates.publishedAt = new Date()
    }

    const [updated] = await db
      .update(contentItems)
      .set(updates)
      .where(eq(contentItems.id, id))
      .returning()
    return { success: true, content: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving publish details', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
