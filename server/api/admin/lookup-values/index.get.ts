import { consola } from 'consola'
import { and, asc, eq, sql } from 'drizzle-orm'

import { crmLookupValues, opportunities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'

/**
 * Returns every lookup value for the caller's org, optionally filtered by
 * `?kind=opportunity_source`. Includes archived rows so the admin UI can show
 * an "Archived" section — the form pickers fetch the same endpoint with the
 * client-side filter to exclude archived rows.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const kind = getQuery(event).kind as string | undefined

    const db = useDrizzle()
    const conds = [eq(crmLookupValues.organizationId, admin.organizationId)]
    if (kind) conds.push(eq(crmLookupValues.kind, kind))

    // Correlated subquery: count opportunities that reference each lookup value
    // by matching the same key on the right column based on `kind`. Admins use
    // this to decide whether Delete is safe (count = 0) or whether Archive is
    // the only sensible option.
    const usageCount = sql<number>`(
      SELECT COUNT(*)::int FROM ${opportunities}
      WHERE ${opportunities.organizationId} = ${crmLookupValues.organizationId}
        AND (
          (${crmLookupValues.kind} = 'opportunity_source' AND ${opportunities.source} = ${crmLookupValues.key})
          OR
          (${crmLookupValues.kind} = 'opportunity_type' AND ${opportunities.type} = ${crmLookupValues.key})
        )
    )`.as('usage_count')

    const rows = await db
      .select({
        id: crmLookupValues.id,
        kind: crmLookupValues.kind,
        key: crmLookupValues.key,
        label: crmLookupValues.label,
        sortOrder: crmLookupValues.sortOrder,
        archivedAt: crmLookupValues.archivedAt,
        createdAt: crmLookupValues.createdAt,
        updatedAt: crmLookupValues.updatedAt,
        usageCount,
      })
      .from(crmLookupValues)
      .where(and(...conds))
      .orderBy(
        asc(crmLookupValues.kind),
        asc(crmLookupValues.sortOrder),
        asc(crmLookupValues.label)
      )

    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing lookup values', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
