import { consola } from 'consola'
import { and, count, desc, eq, gte, lte, type SQL } from 'drizzle-orm'

import { auditLog, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { auditLogFiltersSchema } from '@@/shared/schemas/audit-log'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)

    const parsed = auditLogFiltersSchema.safeParse(getQuery(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid filters' })
    }

    const { userId, resource, action, from, to, page, pageSize } = parsed.data
    const db = useDrizzle()

    // Scope every query to the admin's org so a system admin can't accidentally
    // see cross-org rows from a malformed filter.
    const conditions: SQL[] = [eq(auditLog.organizationId, admin.organizationId)]
    if (userId) conditions.push(eq(auditLog.userId, userId))
    if (resource) conditions.push(eq(auditLog.resource, resource))
    if (action) conditions.push(eq(auditLog.action, action))
    if (from) conditions.push(gte(auditLog.createdAt, new Date(from)))
    if (to) conditions.push(lte(auditLog.createdAt, new Date(to)))

    const where = and(...conditions)

    const offset = (page - 1) * pageSize

    const rows = await db
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        resource: auditLog.resource,
        action: auditLog.action,
        resourceId: auditLog.resourceId,
        meta: auditLog.meta,
        userId: auditLog.userId,
        userEmail: users.email,
        userFirstName: users.firstName,
        userLastName: users.lastName,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(where)
      .orderBy(desc(auditLog.createdAt))
      .limit(pageSize)
      .offset(offset)

    const [{ value: total } = { value: 0 }] = await db
      .select({ value: count() })
      .from(auditLog)
      .where(where)

    // Serialise bigint id to string so the JSON survives the wire.
    const items = rows.map((r) => ({ ...r, id: String(r.id) }))

    return { items, total, page, pageSize }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing audit log', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
