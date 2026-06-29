import { consola } from 'consola'

import { contentItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createContentSchema } from '@@/shared/schemas/communication'

/** Create a content item (starts as draft, authored by the caller). CC-01. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'create')
    const body = await readValidatedBody(event, createContentSchema.parse)
    const db = useDrizzle()

    const [created] = await db
      .insert(contentItems)
      .values({
        organizationId: ctx.organizationId,
        title: body.title,
        type: body.type,
        category: body.category ?? null,
        excerpt: body.excerpt ?? null,
        body: body.body ?? null,
        coverImageUrl: body.coverImageUrl ?? null,
        tags: body.tags ?? [],
        status: 'draft',
        authorUserId: ctx.userId,
      })
      .returning()

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'create',
      resourceId: created!.id,
      meta: { title: created!.title, type: created!.type },
    })

    return { success: true, content: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating content item', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
