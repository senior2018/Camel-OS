import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'

import { contentItems, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** List content items for the content team (newest activity first). CC-05. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const db = useDrizzle()

    const rows = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        type: contentItems.type,
        category: contentItems.category,
        excerpt: contentItems.excerpt,
        tags: contentItems.tags,
        status: contentItems.status,
        authorUserId: contentItems.authorUserId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        publishedAt: contentItems.publishedAt,
        createdAt: contentItems.createdAt,
        updatedAt: contentItems.updatedAt,
      })
      .from(contentItems)
      .leftJoin(users, eq(users.id, contentItems.authorUserId))
      .where(eq(contentItems.organizationId, ctx.organizationId))
      .orderBy(desc(contentItems.updatedAt))
      .limit(500)

    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing content items', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
