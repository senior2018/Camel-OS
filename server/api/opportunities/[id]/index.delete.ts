import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'delete')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const db = useDrizzle()

    const [existing] = await db
      .select({
        ownerUserId: opportunities.ownerUserId,
        createdByUserId: opportunities.createdByUserId,
      })
      .from(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    // Same record-level rule as edit: owner, creator, or system admin only.
    const canDelete =
      ctx.isSystemAdmin ||
      existing.ownerUserId === ctx.userId ||
      existing.createdByUserId === ctx.userId
    if (!canDelete) {
      throw createError({
        statusCode: 403,
        statusMessage: 'You can only delete opportunities you own or created.',
      })
    }

    const [deleted] = await db
      .delete(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .returning({ id: opportunities.id, title: opportunities.title })

    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'delete',
      resourceId: deleted.id,
      meta: { title: deleted.title },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting opportunity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
