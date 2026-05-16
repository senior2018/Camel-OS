import { consola } from 'consola'
import { desc } from 'drizzle-orm'

import { auditLog } from '../database/schema'
import { useDrizzle } from './drizzle'
import { sha256 } from './crypto'

export interface AuditEventInput {
  organizationId?: string | null
  userId?: string | null
  resource: string
  action: string
  resourceId?: string | null
  meta?: Record<string, unknown> | null
}

export async function logAuditEvent(input: AuditEventInput): Promise<void> {
  try {
    const db = useDrizzle()

    const [lastRow] = await db
      .select({ rowHash: auditLog.rowHash })
      .from(auditLog)
      .orderBy(desc(auditLog.id))
      .limit(1)

    const prevHash = lastRow?.rowHash ?? null
    const createdAt = new Date()

    // Canonical object — fixed key order ensures deterministic hash
    const canonical = {
      organizationId: input.organizationId ?? null,
      userId: input.userId ?? null,
      resource: input.resource,
      action: input.action,
      resourceId: input.resourceId ?? null,
      meta: input.meta ?? null,
      prevHash,
      createdAt: createdAt.toISOString(),
    }

    const rowHash = sha256(JSON.stringify(canonical))

    await db.insert(auditLog).values({
      organizationId: canonical.organizationId,
      userId: canonical.userId,
      resource: canonical.resource,
      action: canonical.action,
      resourceId: canonical.resourceId,
      meta: canonical.meta,
      prevHash,
      rowHash,
      createdAt,
    })
  } catch (err) {
    // Audit failure must never break the main request flow
    consola.error('[AuditLog]', (err as Error).message)
  }
}
