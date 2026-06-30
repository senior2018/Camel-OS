import { consola } from 'consola'
import { and, asc, eq, inArray } from 'drizzle-orm'

import { projects, timesheetEntries, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** TS-03 — submitted (and optionally approved) timesheets grouped by person + week. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const q = getQuery(event)
    const statuses =
      String(q.status ?? 'submitted') === 'all'
        ? (['submitted', 'approved', 'rejected'] as const)
        : ([String(q.status ?? 'submitted')] as ('submitted' | 'approved' | 'rejected')[])

    const rows = await useDrizzle()
      .select({
        userId: timesheetEntries.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        weekStartDate: timesheetEntries.weekStartDate,
        entryDate: timesheetEntries.entryDate,
        hours: timesheetEntries.hours,
        projectName: projects.name,
        taskLabel: timesheetEntries.taskLabel,
        note: timesheetEntries.note,
        status: timesheetEntries.status,
      })
      .from(timesheetEntries)
      .leftJoin(users, eq(users.id, timesheetEntries.userId))
      .leftJoin(projects, eq(projects.id, timesheetEntries.projectId))
      .where(
        and(
          eq(timesheetEntries.organizationId, ctx.organizationId),
          inArray(timesheetEntries.status, statuses)
        )
      )
      .orderBy(asc(timesheetEntries.weekStartDate), asc(timesheetEntries.entryDate))

    const groups = new Map<
      string,
      {
        userId: string
        name: string
        weekStart: string
        status: string
        total: number
        entries: { entryDate: string; hours: number; label: string; note: string | null }[]
      }
    >()
    for (const r of rows) {
      const week = r.weekStartDate ?? 'unscheduled'
      const key = `${r.userId}::${week}`
      let g = groups.get(key)
      if (!g) {
        g = {
          userId: r.userId,
          name: [r.firstName, r.lastName].filter(Boolean).join(' ') || 'Staff',
          weekStart: week,
          status: r.status,
          total: 0,
          entries: [],
        }
        groups.set(key, g)
      }
      g.total += Number(r.hours)
      g.entries.push({
        entryDate: r.entryDate,
        hours: Number(r.hours),
        label: r.projectName ?? r.taskLabel ?? 'Task',
        note: r.note,
      })
    }
    return { items: [...groups.values()] }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing timesheets', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
