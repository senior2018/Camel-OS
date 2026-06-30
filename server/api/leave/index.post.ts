import { consola } from 'consola'

import { leaveRequests } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { countWorkingDays } from '@@/server/utils/leave'
import { requireUser } from '@@/server/utils/permission-guard'
import { leaveRequestSchema } from '@@/shared/schemas/hr'

/** HR-03 — submit a leave request for myself (lands as pending). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const body = await readValidatedBody(event, leaveRequestSchema.parse)
    const days = countWorkingDays(body.startDate, body.endDate)
    if (days <= 0) {
      throw createError({ statusCode: 400, statusMessage: 'Selected range has no working days' })
    }
    const [created] = await useDrizzle()
      .insert(leaveRequests)
      .values({
        organizationId: ctx.organizationId,
        userId: ctx.userId,
        type: body.type,
        startDate: body.startDate,
        endDate: body.endDate,
        days: String(days),
        reason: body.reason ?? null,
        status: 'pending',
      })
      .returning()
    return { success: true, request: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error submitting leave', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
