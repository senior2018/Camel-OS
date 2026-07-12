import { consola } from 'consola'
import { z } from 'zod'
import { apiKeys } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { generateApiKey } from '@@/server/utils/api-key'

const schema = z.object({
  name: z.string().trim().min(1).max(120),
  scopes: z.array(z.string()).max(20).default(['read']),
})

/** Mint a new API key — the raw key is returned exactly once. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const b = await readValidatedBody(event, schema.parse)
    const { raw, keyPrefix, keyHash } = generateApiKey()
    const [created] = await useDrizzle()
      .insert(apiKeys)
      .values({
        organizationId: ctx.organizationId,
        name: b.name,
        keyPrefix,
        keyHash,
        scopes: b.scopes,
        createdByUserId: ctx.userId,
      })
      .returning({ id: apiKeys.id })
    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'api_key',
      action: 'create',
      resourceId: created?.id,
      meta: { name: b.name },
    })
    return { success: true, id: created?.id, key: raw }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating API key', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
