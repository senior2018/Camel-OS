import { z } from 'zod'

/**
 * Query parameters accepted by `GET /api/admin/audit-log` and the CSV export.
 * All filters are optional and AND-combined server-side.
 */
export const auditLogFiltersSchema = z.object({
  userId: z.string().uuid().optional(),
  resource: z.string().trim().max(80).optional(),
  action: z.string().trim().max(80).optional(),
  /** ISO date strings, inclusive. */
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  /** 1-indexed page. */
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(10).max(200).default(50),
})

export type AuditLogFilters = z.output<typeof auditLogFiltersSchema>
