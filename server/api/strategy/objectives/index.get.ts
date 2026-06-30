import { consola } from 'consola'
import { and, asc, desc, eq } from 'drizzle-orm'

import { strategicObjectives, strategyKpis, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { objectiveRag } from '@@/server/utils/strategy'
import type { KpiDirection, StrategyStatus } from '@@/shared/schemas/strategy'

/** ST-04 — strategy dashboard data: objectives + derived RAG + progress. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'read')
    const q = getQuery(event)
    const db = useDrizzle()

    const conds = [eq(strategicObjectives.organizationId, ctx.organizationId)]
    if (q.year && !Number.isNaN(Number(q.year))) {
      conds.push(eq(strategicObjectives.year, Number(q.year)))
    }

    const objectives = await db
      .select({
        id: strategicObjectives.id,
        year: strategicObjectives.year,
        title: strategicObjectives.title,
        theme: strategicObjectives.theme,
        manualStatus: strategicObjectives.manualStatus,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
      })
      .from(strategicObjectives)
      .leftJoin(users, eq(users.id, strategicObjectives.ownerUserId))
      .where(and(...conds))
      .orderBy(asc(strategicObjectives.theme), desc(strategicObjectives.createdAt))

    const kpis = await db
      .select({
        objectiveId: strategyKpis.objectiveId,
        baseline: strategyKpis.baseline,
        target: strategyKpis.target,
        current: strategyKpis.current,
        direction: strategyKpis.direction,
      })
      .from(strategyKpis)
      .where(eq(strategyKpis.organizationId, ctx.organizationId))

    const items = objectives.map((o) => {
      const own = kpis.filter((k) => k.objectiveId === o.id)
      const { status, progress } = objectiveRag(
        own.map((k) => ({ ...k, direction: k.direction as KpiDirection })),
        o.manualStatus as StrategyStatus | null
      )
      return {
        id: o.id,
        year: o.year,
        title: o.title,
        theme: o.theme,
        owner: [o.ownerFirstName, o.ownerLastName].filter(Boolean).join(' ') || null,
        kpiCount: own.length,
        progress,
        status,
      }
    })

    const years = [...new Set(objectives.map((o) => o.year))].sort((a, b) => b - a)
    return { items, years }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing objectives', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
