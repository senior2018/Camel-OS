import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import {
  departmentalGoals,
  individualObjectives,
  strategicObjectives,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** ST-05 — my individual objectives, with the goal + objective they ladder up to. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const rows = await useDrizzle()
      .select({
        id: individualObjectives.id,
        title: individualObjectives.title,
        description: individualObjectives.description,
        progressPct: individualObjectives.progressPct,
        status: individualObjectives.status,
        dueDate: individualObjectives.dueDate,
        goalTitle: departmentalGoals.title,
        objectiveTitle: strategicObjectives.title,
      })
      .from(individualObjectives)
      .leftJoin(departmentalGoals, eq(departmentalGoals.id, individualObjectives.goalId))
      .leftJoin(strategicObjectives, eq(strategicObjectives.id, departmentalGoals.objectiveId))
      .where(eq(individualObjectives.userId, ctx.userId))
      .orderBy(asc(individualObjectives.createdAt))
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading my objectives', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
