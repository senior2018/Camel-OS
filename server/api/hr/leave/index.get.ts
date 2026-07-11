import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { leaveRequests, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { LEAVE_STATUSES, type LeaveStatus } from '@@/shared/schemas/hr'

/** HR-03 / HR-04 — org-wide leave (approvals queue + team-calendar source). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const q = getQuery(event)
    const db = useDrizzle()

    const conds = [eq(leaveRequests.organizationId, ctx.organizationId)]
    const statusParam = String(q.status ?? '')
    if (LEAVE_STATUSES.includes(statusParam as LeaveStatus)) {
      conds.push(eq(leaveRequests.status, statusParam as LeaveStatus))
    }

    const rows = await db
      .select({
        id: leaveRequests.id,
        userId: leaveRequests.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        type: leaveRequests.type,
        startDate: leaveRequests.startDate,
        endDate: leaveRequests.endDate,
        days: leaveRequests.days,
        reason: leaveRequests.reason,
        status: leaveRequests.status,
        reviewedAt: leaveRequests.reviewedAt,
        decisionNote: leaveRequests.decisionNote,
        createdAt: leaveRequests.createdAt,
      })
      .from(leaveRequests)
      .leftJoin(users, eq(users.id, leaveRequests.userId))
      .where(and(...conds))
      .orderBy(desc(leaveRequests.startDate))
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing leave', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
