import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clients, donorGrants } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createGrantSchema } from '@@/shared/schemas/client'

/**
 * Record a new funding cycle against a donor (CR-09). Validates the parent is
 * a donor — silently widens to any client type for forward compatibility, but
 * the UI only exposes this on donor profiles.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const donorId = getRouterParam(event, 'id')
    if (!donorId) throw createError({ statusCode: 400, statusMessage: 'Donor id is required' })

    const parsed = createGrantSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid grant payload',
      })
    }

    const data = parsed.data
    const db = useDrizzle()

    const [donor] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, donorId), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)
    if (!donor) throw createError({ statusCode: 404, statusMessage: 'Donor not found' })

    const [created] = await db
      .insert(donorGrants)
      .values({
        donorId,
        organizationId: ctx.organizationId,
        title: data.title,
        startDate: data.startDate ?? null,
        endDate: data.endDate ?? null,
        totalValue: data.totalValue ?? null,
        currency: data.currency,
        reportingSchedule: data.reportingSchedule ?? null,
        nextReportingDate: data.nextReportingDate ?? null,
        status: data.status,
        notes: data.notes ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    if (!created) throw new Error('Failed to create grant')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'grant_created',
      resourceId: donorId,
      meta: { grantId: created.id, title: created.title, endDate: created.endDate },
    })

    return { success: true, grant: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating grant', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
