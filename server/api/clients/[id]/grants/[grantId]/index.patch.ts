import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { donorGrants } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateGrantSchema } from '@@/shared/schemas/client'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const donorId = getRouterParam(event, 'id')
    const grantId = getRouterParam(event, 'grantId')
    if (!donorId || !grantId) {
      throw createError({ statusCode: 400, statusMessage: 'Donor and grant ids are required' })
    }

    const parsed = updateGrantSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid grant payload',
      })
    }

    const data = parsed.data
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.title !== undefined) updates.title = data.title
    if (data.startDate !== undefined) updates.startDate = data.startDate ?? null
    if (data.endDate !== undefined) {
      updates.endDate = data.endDate ?? null
      // Clearing/changing the deadline resets the notification stamp so a
      // re-scheduled deadline gets a fresh 30-day-out email.
      updates.endDateNotifiedAt = null
    }
    if (data.totalValue !== undefined) updates.totalValue = data.totalValue ?? null
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.reportingSchedule !== undefined)
      updates.reportingSchedule = data.reportingSchedule ?? null
    if (data.nextReportingDate !== undefined) {
      updates.nextReportingDate = data.nextReportingDate ?? null
      updates.nextReportingNotifiedAt = null
    }
    if (data.status !== undefined) updates.status = data.status
    if (data.notes !== undefined) updates.notes = data.notes ?? null

    const [updated] = await useDrizzle()
      .update(donorGrants)
      .set(updates)
      .where(
        and(
          eq(donorGrants.id, grantId),
          eq(donorGrants.donorId, donorId),
          eq(donorGrants.organizationId, ctx.organizationId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Grant not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'grant_updated',
      resourceId: donorId,
      meta: { grantId: updated.id, status: updated.status },
    })

    return { success: true, grant: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating grant', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
