import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { certifications, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HR-07 — all certifications/training across staff, with expiry flags. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const q = getQuery(event)
    const db = useDrizzle()

    const conds = [eq(certifications.organizationId, ctx.organizationId)]
    if (q.userId) conds.push(eq(certifications.userId, String(q.userId)))

    const rows = await db
      .select({
        id: certifications.id,
        userId: certifications.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        name: certifications.name,
        issuer: certifications.issuer,
        kind: certifications.kind,
        issuedDate: certifications.issuedDate,
        expiryDate: certifications.expiryDate,
        credentialId: certifications.credentialId,
        notes: certifications.notes,
      })
      .from(certifications)
      .leftJoin(users, eq(users.id, certifications.userId))
      .where(and(...conds))
      .orderBy(asc(certifications.expiryDate))

    const today = new Date().toISOString().slice(0, 10)
    const soon = new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const items = rows.map((r) => ({
      ...r,
      expiryState: !r.expiryDate
        ? 'none'
        : r.expiryDate < today
          ? 'expired'
          : r.expiryDate <= soon
            ? 'expiring'
            : 'valid',
    }))
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing certifications', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
