import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'
import { feedbackItems, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const items = await useDrizzle()
      .select({ f: feedbackItems, first: users.firstName, last: users.lastName })
      .from(feedbackItems)
      .leftJoin(users, eq(users.id, feedbackItems.userId))
      .where(eq(feedbackItems.organizationId, ctx.organizationId))
      .orderBy(desc(feedbackItems.createdAt))
    return { items: items.map((r) => ({ ...r.f, first: r.first, last: r.last })) }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error(error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
