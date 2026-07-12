import { consola } from 'consola'
import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { knowledgeArticles, userRoles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'

/** KM-01/04 — knowledge base list with search, taxonomy facets, and access filtering. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'read')
    const q = getQuery(event)
    const db = useDrizzle()
    const canManage =
      ctx.isSystemAdmin || (await userHasPermission(ctx.userId, 'knowledge', 'admin'))

    const myRoles = await db
      .select({ roleId: userRoles.roleId })
      .from(userRoles)
      .where(eq(userRoles.userId, ctx.userId))
    const roleIds = myRoles.map((r) => r.roleId)

    const conds = [
      eq(knowledgeArticles.organizationId, ctx.organizationId),
      eq(knowledgeArticles.kind, (q.kind as string) === 'help' ? 'help' : 'article'),
    ]
    if (!canManage) {
      conds.push(eq(knowledgeArticles.status, 'published'))
      // Access: org-wide, or restricted-but-shared with one of the caller's roles, or authored by them.
      const acc = [
        eq(knowledgeArticles.visibility, 'everyone'),
        eq(knowledgeArticles.authorUserId, ctx.userId),
      ]
      if (roleIds.length)
        acc.push(
          sql`${knowledgeArticles.allowedRoleIds} ?| ${sql.raw(`array[${roleIds.map((r) => `'${r}'`).join(',')}]`)}`
        )
      conds.push(or(...acc)!)
    }
    if (q.category) conds.push(eq(knowledgeArticles.category, q.category as string))
    if (q.q) {
      const like = `%${(q.q as string).trim()}%`
      conds.push(
        or(
          ilike(knowledgeArticles.title, like),
          ilike(knowledgeArticles.excerpt, like),
          ilike(knowledgeArticles.body, like)
        )!
      )
    }

    const items = await db
      .select({
        id: knowledgeArticles.id,
        title: knowledgeArticles.title,
        excerpt: knowledgeArticles.excerpt,
        category: knowledgeArticles.category,
        tags: knowledgeArticles.tags,
        status: knowledgeArticles.status,
        visibility: knowledgeArticles.visibility,
        helpfulCount: knowledgeArticles.helpfulCount,
        viewCount: knowledgeArticles.viewCount,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        updatedAt: knowledgeArticles.updatedAt,
      })
      .from(knowledgeArticles)
      .leftJoin(users, eq(users.id, knowledgeArticles.authorUserId))
      .where(and(...conds))
      .orderBy(desc(knowledgeArticles.updatedAt))

    const cats = await db
      .selectDistinct({ category: knowledgeArticles.category })
      .from(knowledgeArticles)
      .where(
        and(
          eq(knowledgeArticles.organizationId, ctx.organizationId),
          eq(knowledgeArticles.status, 'published')
        )
      )
    return {
      items,
      categories: cats
        .map((c) => c.category)
        .filter((c): c is string => !!c)
        .sort(),
      canManage,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing knowledge', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
