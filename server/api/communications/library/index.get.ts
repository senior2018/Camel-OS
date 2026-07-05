import { consola } from 'consola'
import { and, count, desc, eq, gte, ilike, lte, or } from 'drizzle-orm'

import { contentItems, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { librarySearchSchema } from '@@/shared/schemas/communication'

const PAGE_SIZE = 12

/**
 * CC-07 — the staff-facing insights library. Published content only, with
 * full-text search (title / excerpt / body) and filters by category, author,
 * and publish date. Returns facet lists so the UI can populate filter menus.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'read')
    const q = await getValidatedQuery(event, librarySearchSchema.parse)
    const db = useDrizzle()

    const conds = [
      eq(contentItems.organizationId, ctx.organizationId),
      eq(contentItems.status, 'published'),
    ]
    if (q.q) {
      const like = `%${q.q}%`
      conds.push(
        or(
          ilike(contentItems.title, like),
          ilike(contentItems.excerpt, like),
          ilike(contentItems.body, like)
        )!
      )
    }
    if (q.category) conds.push(eq(contentItems.category, q.category))
    if (q.author) conds.push(eq(contentItems.authorUserId, q.author))
    if (q.from) conds.push(gte(contentItems.publishedAt, new Date(q.from)))
    if (q.to) conds.push(lte(contentItems.publishedAt, new Date(`${q.to}T23:59:59`)))
    const where = and(...conds)

    const totalRows = await db.select({ total: count() }).from(contentItems).where(where)
    const total = totalRows[0]?.total ?? 0
    const items = await db
      .select({
        id: contentItems.id,
        title: contentItems.title,
        type: contentItems.type,
        category: contentItems.category,
        excerpt: contentItems.excerpt,
        tags: contentItems.tags,
        coverImageUrl: contentItems.coverImageUrl,
        body: contentItems.body,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        publishedAt: contentItems.publishedAt,
      })
      .from(contentItems)
      .leftJoin(users, eq(users.id, contentItems.authorUserId))
      .where(where)
      .orderBy(desc(contentItems.publishedAt))
      .limit(PAGE_SIZE)
      .offset((q.page - 1) * PAGE_SIZE)

    // Facets (over all published content in the org, not the filtered set).
    const publishedScope = and(
      eq(contentItems.organizationId, ctx.organizationId),
      eq(contentItems.status, 'published')
    )
    const catRows = await db
      .selectDistinct({ category: contentItems.category })
      .from(contentItems)
      .where(publishedScope)
    const authorRows = await db
      .selectDistinct({
        id: users.id,
        firstName: users.firstName,
        lastName: users.lastName,
      })
      .from(contentItems)
      .innerJoin(users, eq(users.id, contentItems.authorUserId))
      .where(publishedScope)

    // Fall back to the first inline image in the body when no explicit cover
    // was set, so library cards always have a visual.
    const withCovers = items.map(({ body, ...rest }) => ({
      ...rest,
      coverImageUrl:
        rest.coverImageUrl ?? body?.match(/<img[^>]+src=["']([^"']+)["']/i)?.[1] ?? null,
    }))

    return {
      items: withCovers,
      total: total ?? 0,
      page: q.page,
      pageSize: PAGE_SIZE,
      categories: catRows
        .map((r) => r.category)
        .filter((c): c is string => !!c)
        .sort(),
      authors: authorRows
        .map((a) => ({ id: a.id, name: [a.firstName, a.lastName].filter(Boolean).join(' ') }))
        .sort((a, b) => a.name.localeCompare(b.name)),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading library', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
