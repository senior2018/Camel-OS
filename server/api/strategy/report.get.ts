import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import {
  departmentalGoals,
  strategicObjectives,
  strategyCheckins,
  strategyKpis,
  users,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { objectiveRag } from '@@/server/utils/strategy'
import {
  kpiProgress,
  ragFromProgress,
  STRATEGY_STATUSES,
  type KpiDirection,
  type StrategyStatus,
} from '@@/shared/schemas/strategy'

/** ST-06 — annual strategy review report for a given year. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'read')
    const q = getQuery(event)
    const year = Number(q.year ?? new Date().getFullYear())
    const db = useDrizzle()

    const objectives = await db
      .select({
        id: strategicObjectives.id,
        title: strategicObjectives.title,
        description: strategicObjectives.description,
        theme: strategicObjectives.theme,
        manualStatus: strategicObjectives.manualStatus,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
      })
      .from(strategicObjectives)
      .leftJoin(users, eq(users.id, strategicObjectives.ownerUserId))
      .where(
        and(
          eq(strategicObjectives.organizationId, ctx.organizationId),
          eq(strategicObjectives.year, year)
        )
      )
      .orderBy(asc(strategicObjectives.theme))

    const allKpis = await db
      .select()
      .from(strategyKpis)
      .where(eq(strategyKpis.organizationId, ctx.organizationId))
    const allGoals = await db
      .select({
        objectiveId: departmentalGoals.objectiveId,
        title: departmentalGoals.title,
        department: departmentalGoals.department,
        progressPct: departmentalGoals.progressPct,
        status: departmentalGoals.status,
      })
      .from(departmentalGoals)
      .where(eq(departmentalGoals.organizationId, ctx.organizationId))
    const allCheckins = await db
      .select({
        objectiveId: strategyCheckins.objectiveId,
        summary: strategyCheckins.summary,
        ragStatus: strategyCheckins.ragStatus,
        createdAt: strategyCheckins.createdAt,
      })
      .from(strategyCheckins)
      .where(eq(strategyCheckins.organizationId, ctx.organizationId))

    const items = objectives.map((o) => {
      const kpis = allKpis
        .filter((k) => k.objectiveId === o.id)
        .map((k) => {
          const progress = kpiProgress(
            Number(k.baseline),
            k.target != null ? Number(k.target) : null,
            Number(k.current),
            k.direction as KpiDirection
          )
          return {
            name: k.name,
            unit: k.unit,
            baseline: Number(k.baseline),
            target: k.target != null ? Number(k.target) : null,
            current: Number(k.current),
            progress,
            status: ragFromProgress(progress),
          }
        })
      const { status, progress } = objectiveRag(
        allKpis
          .filter((k) => k.objectiveId === o.id)
          .map((k) => ({
            baseline: k.baseline,
            target: k.target,
            current: k.current,
            direction: k.direction as KpiDirection,
          })),
        o.manualStatus as StrategyStatus | null
      )
      const checkins = allCheckins
        .filter((c) => c.objectiveId === o.id)
        .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
      return {
        title: o.title,
        description: o.description,
        theme: o.theme,
        owner: [o.ownerFirstName, o.ownerLastName].filter(Boolean).join(' ') || null,
        status,
        progress,
        kpis,
        goals: allGoals.filter((g) => g.objectiveId === o.id),
        latestCheckin: checkins[0] ?? null,
      }
    })

    const summary = Object.fromEntries(
      STRATEGY_STATUSES.map((s) => [s, items.filter((i) => i.status === s).length])
    ) as Record<StrategyStatus, number>
    const avgProgress = items.length
      ? Math.round(items.reduce((s, i) => s + i.progress, 0) / items.length)
      : 0

    return { year, items, summary, avgProgress, totalObjectives: items.length }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building strategy report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
