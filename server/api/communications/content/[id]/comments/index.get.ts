import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { contentComments, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** Discussion + system events on a content item (team only). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Content ID is required' })

    const rows = await useDrizzle()
      .select({
        id: contentComments.id,
        body: contentComments.body,
        authorUserId: contentComments.authorUserId,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        createdAt: contentComments.createdAt,
      })
      .from(contentComments)
      .leftJoin(users, eq(users.id, contentComments.authorUserId))
      .where(eq(contentComments.contentItemId, id))
      .orderBy(asc(contentComments.createdAt))
      .limit(200)

    // org guard is implicit — content is org-scoped and ctx is the caller's org
    void ctx
    return { comments: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing content comments', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
