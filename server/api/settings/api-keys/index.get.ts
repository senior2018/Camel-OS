import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'
import { apiKeys } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'

/** REST API keys (admin only). Raw keys are never returned after creation. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const items = await useDrizzle()
      .select({
        id: apiKeys.id,
        name: apiKeys.name,
        keyPrefix: apiKeys.keyPrefix,
        scopes: apiKeys.scopes,
        lastUsedAt: apiKeys.lastUsedAt,
        expiresAt: apiKeys.expiresAt,
        revokedAt: apiKeys.revokedAt,
        createdAt: apiKeys.createdAt,
      })
      .from(apiKeys)
      .where(eq(apiKeys.organizationId, ctx.organizationId))
      .orderBy(desc(apiKeys.createdAt))
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing API keys', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
