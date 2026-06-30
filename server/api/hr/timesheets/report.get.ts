import { consola } from 'consola'
import { and, eq, gte, lte } from 'drizzle-orm'

import { expertProfiles, projects, timesheetEntries, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** TS-04 / TS-05 — cross-staff hours + cost-to-project from approved timesheets. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'timesheet', 'read')
    const q = getQuery(event)
    const today = new Date()
    const defFrom = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
    const from = String(q.from ?? defFrom)
    const to = String(q.to ?? today.toISOString().slice(0, 10))
    const db = useDrizzle()

    const rows = await db
      .select({
        userId: timesheetEntries.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        projectId: timesheetEntries.projectId,
        projectName: projects.name,
        hours: timesheetEntries.hours,
      })
      .from(timesheetEntries)
      .leftJoin(users, eq(users.id, timesheetEntries.userId))
      .leftJoin(projects, eq(projects.id, timesheetEntries.projectId))
      .where(
        and(
          eq(timesheetEntries.organizationId, ctx.organizationId),
          eq(timesheetEntries.status, 'approved'),
          gte(timesheetEntries.entryDate, from),
          lte(timesheetEntries.entryDate, to)
        )
      )

    // Hourly cost rate per user = expert day rate / 8 (0 when no profile/rate).
    const rateRows = await db
      .select({ userId: expertProfiles.userId, dailyRate: expertProfiles.dailyRate })
      .from(expertProfiles)
      .where(eq(expertProfiles.organizationId, ctx.organizationId))
    const hourly = new Map<string, number>()
    for (const r of rateRows) hourly.set(r.userId, r.dailyRate ? Number(r.dailyRate) / 8 : 0)

    const byUser = new Map<string, { name: string; hours: number; cost: number }>()
    const byProject = new Map<string, { projectName: string; hours: number; cost: number }>()
    let totalHours = 0
    let totalCost = 0
    for (const r of rows) {
      const h = Number(r.hours)
      const cost = h * (hourly.get(r.userId) ?? 0)
      totalHours += h
      totalCost += cost
      const uName = [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Staff'
      const u = byUser.get(r.userId) ?? { name: uName, hours: 0, cost: 0 }
      u.hours += h
      u.cost += cost
      byUser.set(r.userId, u)
      const pKey = r.projectId ?? 'internal'
      const pName = r.projectName ?? 'Internal / non-project'
      const p = byProject.get(pKey) ?? { projectName: pName, hours: 0, cost: 0 }
      p.hours += h
      p.cost += cost
      byProject.set(pKey, p)
    }

    return {
      from,
      to,
      totalHours,
      totalCost: Math.round(totalCost),
      byUser: [...byUser.values()].sort((a, b) => b.hours - a.hours),
      byProject: [...byProject.values()].sort((a, b) => b.cost - a.cost),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building timesheet report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
