import { consola } from 'consola'
import { and, desc, eq, gte, lte } from 'drizzle-orm'

import { stakeholderActivities, stakeholders } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireContentTeam } from '@@/server/utils/communications'

/** CC-17 — stakeholder engagement report by period (filterable, exportable). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireContentTeam(event)
    const q = getQuery(event)
    const db = useDrizzle()

    const conds = [eq(stakeholderActivities.organizationId, ctx.organizationId)]
    if (q.from) conds.push(gte(stakeholderActivities.activityDate, String(q.from)))
    if (q.to) conds.push(lte(stakeholderActivities.activityDate, String(q.to)))

    const activities = await db
      .select({
        id: stakeholderActivities.id,
        stakeholderId: stakeholderActivities.stakeholderId,
        stakeholderName: stakeholders.name,
        activityDate: stakeholderActivities.activityDate,
        type: stakeholderActivities.type,
        outcome: stakeholderActivities.outcome,
      })
      .from(stakeholderActivities)
      .innerJoin(stakeholders, eq(stakeholders.id, stakeholderActivities.stakeholderId))
      .where(and(...conds))
      .orderBy(desc(stakeholderActivities.activityDate))

    const byType: Record<string, number> = {}
    const engaged = new Set<string>()
    for (const a of activities) {
      byType[a.type] = (byType[a.type] ?? 0) + 1
      engaged.add(a.stakeholderId)
    }

    return {
      activities,
      summary: {
        stakeholdersEngaged: engaged.size,
        totalActivities: activities.length,
        byType: Object.entries(byType)
          .map(([type, count]) => ({ type, count }))
          .sort((a, b) => b.count - a.count),
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building engagement report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
