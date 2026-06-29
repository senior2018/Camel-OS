import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { updateContentSchema } from '@@/shared/schemas/communication'

/**
 * Update a content item — also the autosave target for the editor (CC-01).
 * Status is driven by the workflow endpoints, not free-set here. Editing a
 * published or in-review item is blocked unless changes were requested.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const data = await readValidatedBody(event, updateContentSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: contentItems.id, status: contentItems.status })
      .from(contentItems)
      .where(and(eq(contentItems.id, id), eq(contentItems.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Content not found' })

    // The body is locked during review; scheduling / campaign / metadata stay editable.
    if (existing.status === 'in_review' && data.body !== undefined) {
      throw createError({
        statusCode: 409,
        statusMessage: 'Content is in review — recall it before editing the body.',
      })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.title !== undefined) updates.title = data.title
    if (data.type !== undefined) updates.type = data.type
    if (data.category !== undefined) updates.category = data.category ?? null
    if (data.excerpt !== undefined) updates.excerpt = data.excerpt ?? null
    if (data.body !== undefined) updates.body = data.body ?? null
    if (data.coverImageUrl !== undefined) updates.coverImageUrl = data.coverImageUrl ?? null
    if (data.tags !== undefined) updates.tags = data.tags
    if (data.scheduledFor !== undefined)
      updates.scheduledFor = data.scheduledFor ? new Date(data.scheduledFor) : null
    if (data.campaignId !== undefined) updates.campaignId = data.campaignId ?? null
    // Edits after a changes-requested round move it back to a working draft.
    if (existing.status === 'changes_requested') updates.status = 'draft'

    const [updated] = await db
      .update(contentItems)
      .set(updates)
      .where(eq(contentItems.id, id))
      .returning()

    return { success: true, content: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating content item', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
