import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { stakeholderActivities, stakeholders, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** Stakeholder profile + engagement activity timeline (CC-14/15/16). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const db = useDrizzle()

    const [stakeholder] = await db
      .select({
        id: stakeholders.id,
        name: stakeholders.name,
        type: stakeholders.type,
        sector: stakeholders.sector,
        geography: stakeholders.geography,
        influence: stakeholders.influence,
        interest: stakeholders.interest,
        engagementStrategy: stakeholders.engagementStrategy,
        ownerUserId: stakeholders.ownerUserId,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        createdAt: stakeholders.createdAt,
      })
      .from(stakeholders)
      .leftJoin(users, eq(users.id, stakeholders.ownerUserId))
      .where(and(eq(stakeholders.id, id), eq(stakeholders.organizationId, ctx.organizationId)))
      .limit(1)
    if (!stakeholder) throw createError({ statusCode: 404, statusMessage: 'Stakeholder not found' })

    const activities = await db
      .select({
        id: stakeholderActivities.id,
        activityDate: stakeholderActivities.activityDate,
        type: stakeholderActivities.type,
        description: stakeholderActivities.description,
        outcome: stakeholderActivities.outcome,
        nextStep: stakeholderActivities.nextStep,
        loggedByFirstName: users.firstName,
        loggedByLastName: users.lastName,
      })
      .from(stakeholderActivities)
      .leftJoin(users, eq(users.id, stakeholderActivities.loggedByUserId))
      .where(eq(stakeholderActivities.stakeholderId, id))
      .orderBy(desc(stakeholderActivities.activityDate), desc(stakeholderActivities.createdAt))

    return { stakeholder, activities }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading stakeholder', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
