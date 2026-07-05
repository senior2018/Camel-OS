import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { contentItems, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** A single PUBLISHED content item, readable by any staff member (CC-07). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })

    const [item] = await useDrizzle()
      .select({
        id: contentItems.id,
        title: contentItems.title,
        type: contentItems.type,
        category: contentItems.category,
        excerpt: contentItems.excerpt,
        body: contentItems.body,
        coverImageUrl: contentItems.coverImageUrl,
        tags: contentItems.tags,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        publishedAt: contentItems.publishedAt,
      })
      .from(contentItems)
      .leftJoin(users, eq(users.id, contentItems.authorUserId))
      .where(
        and(
          eq(contentItems.id, id),
          eq(contentItems.organizationId, ctx.organizationId),
          eq(contentItems.status, 'published')
        )
      )
      .limit(1)

    if (!item) throw createError({ statusCode: 404, statusMessage: 'Not found' })
    // Fall back to the first inline image as the cover banner when none was set.
    const coverImageUrl =
      item.coverImageUrl ?? item.body?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null
    return { content: { ...item, coverImageUrl } }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading library item', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
