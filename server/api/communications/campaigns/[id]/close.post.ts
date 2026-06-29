import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { campaigns } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { closeCampaignSchema } from '@@/shared/schemas/communication'

/** CC-13 — close a campaign and record its final report. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'communications', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Campaign ID is required' })
    const body = await readValidatedBody(event, closeCampaignSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: campaigns.id, status: campaigns.status })
      .from(campaigns)
      .where(and(eq(campaigns.id, id), eq(campaigns.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Campaign not found' })
    if (existing.status === 'closed') {
      throw createError({ statusCode: 409, statusMessage: 'Campaign is already closed.' })
    }

    await db
      .update(campaigns)
      .set({
        status: 'closed',
        reportSummary: body.reportSummary,
        closedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(campaigns.id, id))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'update',
      resourceId: id,
      meta: { kind: 'campaign', event: 'closed' },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error closing campaign', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
