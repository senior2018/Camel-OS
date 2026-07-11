import { consola } from 'consola'
import { and, asc, desc, eq, inArray } from 'drizzle-orm'

import {
  departmentalGoals,
  individualObjectives,
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
  type KpiDirection,
  type StrategyStatus,
} from '@@/shared/schemas/strategy'

/** ST-01..05 — full objective cascade: KPIs, departmental goals + individuals, check-ins. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'strategy', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const db = useDrizzle()

    const [objective] = await db
      .select({
        id: strategicObjectives.id,
        year: strategicObjectives.year,
        title: strategicObjectives.title,
        description: strategicObjectives.description,
        theme: strategicObjectives.theme,
        ownerUserId: strategicObjectives.ownerUserId,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        manualStatus: strategicObjectives.manualStatus,
      })
      .from(strategicObjectives)
      .leftJoin(users, eq(users.id, strategicObjectives.ownerUserId))
      .where(
        and(
          eq(strategicObjectives.id, id),
          eq(strategicObjectives.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!objective) throw createError({ statusCode: 404, statusMessage: 'Objective not found' })

    const kpiRows = await db
      .select()
      .from(strategyKpis)
      .where(eq(strategyKpis.objectiveId, id))
      .orderBy(asc(strategyKpis.createdAt))
    const kpis = kpiRows.map((k) => {
      const progress = kpiProgress(
        Number(k.baseline),
        k.target != null ? Number(k.target) : null,
        Number(k.current),
        k.direction as KpiDirection
      )
      return { ...k, progress, status: ragFromProgress(progress) }
    })

    const { status, progress } = objectiveRag(
      kpiRows.map((k) => ({
        baseline: k.baseline,
        target: k.target,
        current: k.current,
        direction: k.direction as KpiDirection,
      })),
      objective.manualStatus as StrategyStatus | null
    )

    const goalRows = await db
      .select({
        id: departmentalGoals.id,
        title: departmentalGoals.title,
        description: departmentalGoals.description,
        department: departmentalGoals.department,
        ownerUserId: departmentalGoals.ownerUserId,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        progressPct: departmentalGoals.progressPct,
        status: departmentalGoals.status,
        dueDate: departmentalGoals.dueDate,
      })
      .from(departmentalGoals)
      .leftJoin(users, eq(users.id, departmentalGoals.ownerUserId))
      .where(eq(departmentalGoals.objectiveId, id))
      .orderBy(asc(departmentalGoals.createdAt))

    const goalIds = goalRows.map((g) => g.id)
    const indiv = goalIds.length
      ? await db
          .select({
            id: individualObjectives.id,
            goalId: individualObjectives.goalId,
            userId: individualObjectives.userId,
            firstName: users.firstName,
            lastName: users.lastName,
            title: individualObjectives.title,
            progressPct: individualObjectives.progressPct,
            status: individualObjectives.status,
            dueDate: individualObjectives.dueDate,
          })
          .from(individualObjectives)
          .leftJoin(users, eq(users.id, individualObjectives.userId))
          .where(inArray(individualObjectives.goalId, goalIds))
          .orderBy(asc(individualObjectives.createdAt))
      : []

    const goals = goalRows.map((g) => ({
      ...g,
      owner: [g.ownerFirstName, g.ownerLastName].filter(Boolean).join(' ') || null,
      individuals: indiv
        .filter((i) => i.goalId === g.id)
        .map((i) => ({
          ...i,
          owner: [i.firstName, i.lastName].filter(Boolean).join(' ') || 'Staff',
        })),
    }))

    const author = users
    const checkins = await db
      .select({
        id: strategyCheckins.id,
        summary: strategyCheckins.summary,
        ragStatus: strategyCheckins.ragStatus,
        firstName: author.firstName,
        lastName: author.lastName,
        createdAt: strategyCheckins.createdAt,
      })
      .from(strategyCheckins)
      .leftJoin(author, eq(author.id, strategyCheckins.createdByUserId))
      .where(eq(strategyCheckins.objectiveId, id))
      .orderBy(desc(strategyCheckins.createdAt))

    return {
      objective: {
        ...objective,
        owner:
          [objective.ownerFirstName, objective.ownerLastName].filter(Boolean).join(' ') || null,
        status,
        progress,
      },
      kpis,
      goals,
      checkins: checkins.map((c) => ({
        ...c,
        author: [c.firstName, c.lastName].filter(Boolean).join(' ') || 'User',
      })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading objective', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
