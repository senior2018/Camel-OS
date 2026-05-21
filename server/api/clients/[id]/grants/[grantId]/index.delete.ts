import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { donorGrants } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const donorId = getRouterParam(event, 'id')
    const grantId = getRouterParam(event, 'grantId')
    if (!donorId || !grantId) {
      throw createError({ statusCode: 400, statusMessage: 'Donor and grant ids are required' })
    }

    const [deleted] = await useDrizzle()
      .delete(donorGrants)
      .where(
        and(
          eq(donorGrants.id, grantId),
          eq(donorGrants.donorId, donorId),
          eq(donorGrants.organizationId, ctx.organizationId)
        )
      )
      .returning({ id: donorGrants.id, title: donorGrants.title })

    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Grant not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'grant_removed',
      resourceId: donorId,
      meta: { grantId: deleted.id, title: deleted.title },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting grant', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
