import { consola } from 'consola'
import { and, eq, gte, lte, or } from 'drizzle-orm'

import { contentItems } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/**
 * CC-04 — content calendar feed. Returns items whose planned date
 * (`scheduledFor`) or actual publish date falls in the requested window.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const q = getQuery(event)
    const from = q.from ? new Date(String(q.from)) : new Date(Date.now() - 31 * 86_400_000)
    const to = q.to ? new Date(`${String(q.to)}T23:59:59`) : new Date(Date.now() + 62 * 86_400_000)
    const db = useDrizzle()

    const items = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        type: contentItems.type,
        status: contentItems.status,
        scheduledFor: contentItems.scheduledFor,
        publishedAt: contentItems.publishedAt,
        excerpt: contentItems.excerpt,
        coverImageUrl: contentItems.coverImageUrl,
        platform: contentItems.platform,
        publishedUrl: contentItems.publishedUrl,
      })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.organizationId, ctx.organizationId),
          or(
            and(gte(contentItems.scheduledFor, from), lte(contentItems.scheduledFor, to)),
            and(gte(contentItems.publishedAt, from), lte(contentItems.publishedAt, to))
          )
        )
      )
      .limit(500)

    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading calendar', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
