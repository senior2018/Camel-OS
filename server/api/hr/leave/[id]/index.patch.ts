import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { leaveRequests } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { createNotifications } from '@@/server/utils/notifications'
import { requirePermission } from '@@/server/utils/permission-guard'
import { LEAVE_TYPE_LABEL, leaveDecisionSchema, type LeaveType } from '@@/shared/schemas/hr'

/** HR-03 — approve / reject / cancel a leave request (manager or HR). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, leaveDecisionSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select()
      .from(leaveRequests)
      .where(and(eq(leaveRequests.id, id), eq(leaveRequests.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Request not found' })

    await db
      .update(leaveRequests)
      .set({
        status: body.status,
        decisionNote: body.decisionNote ?? null,
        reviewedByUserId: ctx.userId,
        reviewedAt: new Date(),
      })
      .where(eq(leaveRequests.id, id))

    const verb =
      body.status === 'approved'
        ? 'approved'
        : body.status === 'rejected'
          ? 'declined'
          : 'cancelled'
    await createNotifications([
      {
        organizationId: ctx.organizationId,
        userId: existing.userId,
        type: 'leave_decision',
        title: `Leave ${verb}`,
        body: `Your ${LEAVE_TYPE_LABEL[existing.type as LeaveType]} leave (${existing.startDate} → ${existing.endDate}) was ${verb}.`,
        linkUrl: '/leave',
      },
    ])
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deciding leave', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
