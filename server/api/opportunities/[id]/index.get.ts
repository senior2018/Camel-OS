import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const [row] = await useDrizzle()
      .select({
        opportunity: opportunities,
        ownerEmail: users.email,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
      })
      .from(opportunities)
      .leftJoin(users, eq(users.id, opportunities.ownerUserId))
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)

    if (!row) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    return {
      opportunity: row.opportunity,
      owner: row.ownerEmail
        ? { email: row.ownerEmail, firstName: row.ownerFirstName, lastName: row.ownerLastName }
        : null,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching opportunity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
