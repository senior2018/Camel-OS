import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { opportunities, opportunityComments, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** S7 — Comments + owner updates on an opportunity, oldest first. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const db = useDrizzle()

    const [opp] = await db
      .select({ id: opportunities.id })
      .from(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)
    if (!opp) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })

    const items = await db
      .select({
        id: opportunityComments.id,
        kind: opportunityComments.kind,
        body: opportunityComments.body,
        attachmentUrl: opportunityComments.attachmentUrl,
        createdByUserId: opportunityComments.createdByUserId,
        createdAt: opportunityComments.createdAt,
        createdByFirstName: users.firstName,
        createdByLastName: users.lastName,
        createdByEmail: users.email,
      })
      .from(opportunityComments)
      .leftJoin(users, eq(users.id, opportunityComments.createdByUserId))
      .where(eq(opportunityComments.opportunityId, id))
      .orderBy(asc(opportunityComments.createdAt))

    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing opportunity comments', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
