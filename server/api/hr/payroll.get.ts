import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { employeeProfiles, leaveRequests, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { countWorkingDays } from '@@/server/utils/leave'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HR-06 — payroll-ready run for a month (HR admin only; salary data). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'admin')
    const q = getQuery(event)
    const now = new Date()
    const month = String(
      q.month ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    )
    const [yy, mm] = month.split('-').map(Number)
    const monthStart = `${month}-01`
    const monthEnd = new Date(yy!, mm!, 0).toISOString().slice(0, 10) // last day
    const workingDaysInMonth = countWorkingDays(monthStart, monthEnd)
    const db = useDrizzle()

    const employees = await db
      .select({
        userId: employeeProfiles.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        employeeNumber: employeeProfiles.employeeNumber,
        jobTitle: employeeProfiles.jobTitle,
        status: employeeProfiles.status,
        baseSalary: employeeProfiles.baseSalary,
        currency: employeeProfiles.currency,
      })
      .from(employeeProfiles)
      .leftJoin(users, eq(users.id, employeeProfiles.userId))
      .where(eq(employeeProfiles.organizationId, ctx.organizationId))

    // Approved unpaid leave overlapping the month, per user.
    const unpaid = await db
      .select({
        userId: leaveRequests.userId,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
      })
      .from(leaveRequests)
      .where(
        and(
          eq(leaveRequests.organizationId, ctx.organizationId),
          eq(leaveRequests.status, 'approved'),
          eq(leaveRequests.type, 'unpaid')
        )
      )
    const unpaidDaysByUser = new Map<string, number>()
    for (const l of unpaid) {
      const from = l.startDate > monthStart ? l.startDate : monthStart
      const to = l.endDate < monthEnd ? l.endDate : monthEnd
      if (to < from) continue
      unpaidDaysByUser.set(
        l.userId,
        (unpaidDaysByUser.get(l.userId) ?? 0) + countWorkingDays(from, to)
      )
    }

    const rows = employees
      .filter((e) => e.status !== 'terminated')
      .map((e) => {
        const base = Number(e.baseSalary ?? 0)
        const unpaidDays = unpaidDaysByUser.get(e.userId) ?? 0
        const deduction = workingDaysInMonth
          ? Math.round((base / workingDaysInMonth) * unpaidDays)
          : 0
        return {
          userId: e.userId,
          name: [e.firstName, e.lastName].filter(Boolean).join(' ') || 'Staff',
          employeeNumber: e.employeeNumber,
          jobTitle: e.jobTitle,
          currency: e.currency,
          baseSalary: base,
          unpaidDays,
          deduction,
          net: base - deduction,
        }
      })
      .sort((a, b) => a.name.localeCompare(b.name))

    const totalNet = rows.reduce((s, r) => s + r.net, 0)
    return { month, workingDaysInMonth, rows, totalNet }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building payroll', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
