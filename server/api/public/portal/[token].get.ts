import { consola } from 'consola'
import { and, asc, desc, eq } from 'drizzle-orm'

import {
  clients,
  melDataPoints,
  melIndicators,
  projectMilestones,
  projectReports,
  projects,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'

/**
 * ME-06 — PUBLIC read-only donor/client portal. No auth: access is the
 * unguessable share token. Exposes only progress-level data for one project.
 */
export default defineEventHandler(async (event) => {
  try {
    const token = getRouterParam(event, 'token')
    if (!token) throw createError({ statusCode: 400, statusMessage: 'Token required' })
    const db = useDrizzle()

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        clientName: clients.name,
      })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .where(eq(projects.portalToken, token))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Portal not found' })

    const milestones = await db
      .select({
        id: projectMilestones.id,
        name: projectMilestones.name,
        dueDate: projectMilestones.dueDate,
        status: projectMilestones.status,
      })
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, project.id))
      .orderBy(asc(projectMilestones.orderIndex))

    const indicators = await db
      .select({
        id: melIndicators.id,
        name: melIndicators.name,
        level: melIndicators.level,
        target: melIndicators.target,
        baseline: melIndicators.baseline,
        unit: melIndicators.unit,
      })
      .from(melIndicators)
      .where(and(eq(melIndicators.projectId, project.id), eq(melIndicators.level, 'indicator')))
      .orderBy(asc(melIndicators.orderIndex))

    const points = await db
      .select({ indicatorId: melDataPoints.indicatorId, value: melDataPoints.value, periodDate: melDataPoints.periodDate })
      .from(melDataPoints)
      .where(eq(melDataPoints.projectId, project.id))
      .orderBy(asc(melDataPoints.periodDate))
    const latest = new Map<string, number>()
    for (const p of points) latest.set(p.indicatorId, Number(p.value))

    const reports = await db
      .select({ title: projectReports.title, updatedAt: projectReports.updatedAt })
      .from(projectReports)
      .where(and(eq(projectReports.projectId, project.id), eq(projectReports.status, 'approved')))
      .orderBy(desc(projectReports.updatedAt))

    return {
      project,
      milestones,
      indicators: indicators.map((i) => ({ ...i, latest: latest.get(i.id) ?? null })),
      reports,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading portal', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
