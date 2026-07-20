import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { apiKeys } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/** Revoke an API key (soft — keeps the audit trail). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    await useDrizzle()
      .update(apiKeys)
      .set({ revokedAt: new Date() })
      .where(and(eq(apiKeys.id, id), eq(apiKeys.organizationId, ctx.organizationId)))
    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'api_key',
      action: 'delete',
      resourceId: id,
    })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error revoking API key', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
