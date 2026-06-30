import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'

import { employeeProfiles, leaveRequests } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** HR-03 — my leave requests + my annual-leave balance. Self-service (any user). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const db = useDrizzle()

    const requests = await db
      .select()
      .from(leaveRequests)
      .where(eq(leaveRequests.userId, ctx.userId))
      .orderBy(desc(leaveRequests.startDate))

    const [profile] = await db
      .select({ entitlement: employeeProfiles.annualLeaveEntitlement })
      .from(employeeProfiles)
      .where(eq(employeeProfiles.userId, ctx.userId))
      .limit(1)
    const entitlement = Number(profile?.entitlement ?? 21)

    const year = new Date().getFullYear()
    const usedAnnual = requests
      .filter(
        (r) =>
          r.type === 'annual' &&
          r.status === 'approved' &&
          new Date(r.startDate).getFullYear() === year
      )
      .reduce((s, r) => s + Number(r.days), 0)
    const pendingAnnual = requests
      .filter(
        (r) =>
          r.type === 'annual' &&
          r.status === 'pending' &&
          new Date(r.startDate).getFullYear() === year
      )
      .reduce((s, r) => s + Number(r.days), 0)

    return {
      requests,
      balance: {
        entitlement,
        used: usedAnnual,
        pending: pendingAnnual,
        remaining: Math.max(0, entitlement - usedAnnual),
        year,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading leave', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
