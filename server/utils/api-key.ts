import { createHash, randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'
import type { H3Event } from 'h3'

import { apiKeys } from '../database/schema'
import { useDrizzle } from './drizzle'

const PREFIX = 'ck_'

/** Generate a new API key: returns the one-time raw key + its stored parts. */
export function generateApiKey() {
  const raw = PREFIX + randomBytes(24).toString('hex')
  return {
    raw,
    keyPrefix: raw.slice(0, 10),
    keyHash: createHash('sha256').update(raw).digest('hex'),
  }
}

/**
 * Authenticate a REST request by its `Authorization: Bearer <key>` (or
 * `x-api-key`) header. Returns the org id + key id, or throws 401.
 */
export async function requireApiKey(
  event: H3Event
): Promise<{ organizationId: string; keyId: string }> {
  const header = getHeader(event, 'authorization')
  const raw = header?.startsWith('Bearer ') ? header.slice(7) : getHeader(event, 'x-api-key')
  if (!raw) throw createError({ statusCode: 401, statusMessage: 'API key required.' })
  const keyHash = createHash('sha256').update(raw).digest('hex')
  const [row] = await useDrizzle()
    .select({
      id: apiKeys.id,
      organizationId: apiKeys.organizationId,
      expiresAt: apiKeys.expiresAt,
    })
    .from(apiKeys)
    .where(and(eq(apiKeys.keyHash, keyHash), isNull(apiKeys.revokedAt)))
    .limit(1)
  if (!row) throw createError({ statusCode: 401, statusMessage: 'Invalid API key.' })
  if (row.expiresAt && row.expiresAt < new Date())
    throw createError({ statusCode: 401, statusMessage: 'API key expired.' })
  await useDrizzle().update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, row.id))
  return { organizationId: row.organizationId, keyId: row.id }
}
