import { consola } from 'consola'
import { and, desc, eq, gte, lte, type SQL } from 'drizzle-orm'

import { auditLog, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { auditLogFiltersSchema } from '@@/shared/schemas/audit-log'

const MAX_EXPORT_ROWS = 10_000

/** Escape a CSV cell per RFC 4180 — wrap in quotes if it contains ", , or \n. */
function csvCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  const str = typeof value === 'string' ? value : JSON.stringify(value)
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)

    // Reuse the list filters, but ignore pagination — we cap server-side instead.
    const parsed = auditLogFiltersSchema.safeParse(getQuery(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid filters' })
    }
    const { userId, resource, action, from, to } = parsed.data

    const conditions: SQL[] = [eq(auditLog.organizationId, admin.organizationId)]
    if (userId) conditions.push(eq(auditLog.userId, userId))
    if (resource) conditions.push(eq(auditLog.resource, resource))
    if (action) conditions.push(eq(auditLog.action, action))
    if (from) conditions.push(gte(auditLog.createdAt, new Date(from)))
    if (to) conditions.push(lte(auditLog.createdAt, new Date(to)))

    const rows = await useDrizzle()
      .select({
        id: auditLog.id,
        createdAt: auditLog.createdAt,
        resource: auditLog.resource,
        action: auditLog.action,
        resourceId: auditLog.resourceId,
        meta: auditLog.meta,
        userId: auditLog.userId,
        userEmail: users.email,
      })
      .from(auditLog)
      .leftJoin(users, eq(users.id, auditLog.userId))
      .where(and(...conditions))
      .orderBy(desc(auditLog.createdAt))
      .limit(MAX_EXPORT_ROWS)

    const header = ['Timestamp', 'User', 'User ID', 'Resource', 'Action', 'Resource ID', 'Metadata']
    const lines = [header.join(',')]
    for (const r of rows) {
      lines.push(
        [
          csvCell(r.createdAt.toISOString()),
          csvCell(r.userEmail ?? ''),
          csvCell(r.userId ?? ''),
          csvCell(r.resource),
          csvCell(r.action),
          csvCell(r.resourceId ?? ''),
          csvCell(r.meta),
        ].join(',')
      )
    }

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'audit_log',
      action: 'export',
      meta: { rowCount: rows.length, filters: parsed.data },
    })

    setResponseHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
    setResponseHeader(
      event,
      'Content-Disposition',
      `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`
    )
    return lines.join('\n')
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error exporting audit log', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
