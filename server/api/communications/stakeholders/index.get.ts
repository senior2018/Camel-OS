import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { stakeholders, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** CC-14 — stakeholder register (for the influence/interest matrix + list). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const rows = await useDrizzle()
      .select({
        id: stakeholders.id,
        name: stakeholders.name,
        type: stakeholders.type,
        sector: stakeholders.sector,
        geography: stakeholders.geography,
        influence: stakeholders.influence,
        interest: stakeholders.interest,
        engagementStrategy: stakeholders.engagementStrategy,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
      })
      .from(stakeholders)
      .leftJoin(users, eq(users.id, stakeholders.ownerUserId))
      .where(eq(stakeholders.organizationId, ctx.organizationId))
      .orderBy(asc(stakeholders.name))
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing stakeholders', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
