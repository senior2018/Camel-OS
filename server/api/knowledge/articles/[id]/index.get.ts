import { consola } from 'consola'
import { and, eq, sql } from 'drizzle-orm'
import { knowledgeArticles, knowledgeFeedback, userRoles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'

/** KM-01 — a single article (access-checked); bumps the view counter. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const db = useDrizzle()
    const [a] = await db
      .select({
        article: knowledgeArticles,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
      })
      .from(knowledgeArticles)
      .leftJoin(users, eq(users.id, knowledgeArticles.authorUserId))
      .where(
        and(eq(knowledgeArticles.id, id), eq(knowledgeArticles.organizationId, ctx.organizationId))
      )
      .limit(1)
    if (!a) throw createError({ statusCode: 404, statusMessage: 'Not found' })

    const canManage =
      ctx.isSystemAdmin || (await userHasPermission(ctx.userId, 'knowledge', 'admin'))
    if (
      !canManage &&
      a.article.visibility === 'restricted' &&
      a.article.authorUserId !== ctx.userId
    ) {
      const roles = await db
        .select({ roleId: userRoles.roleId })
        .from(userRoles)
        .where(eq(userRoles.userId, ctx.userId))
      const ok = roles.some((r) => a.article.allowedRoleIds.includes(r.roleId))
      if (!ok)
        throw createError({
          statusCode: 403,
          statusMessage: 'You do not have access to this article.',
        })
    }
    if (a.article.status === 'published') {
      await db
        .update(knowledgeArticles)
        .set({ viewCount: sql`${knowledgeArticles.viewCount} + 1` })
        .where(eq(knowledgeArticles.id, id))
    }
    const [mine] = await db
      .select({ helpful: knowledgeFeedback.helpful })
      .from(knowledgeFeedback)
      .where(and(eq(knowledgeFeedback.articleId, id), eq(knowledgeFeedback.userId, ctx.userId)))
      .limit(1)
    return {
      article: {
        ...a.article,
        authorFirstName: a.authorFirstName,
        authorLastName: a.authorLastName,
      },
      myFeedback: mine?.helpful ?? null,
      canManage,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading article', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
