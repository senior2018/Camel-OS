import { consola } from 'consola'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { crmLookupValues } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * Returns active (non-archived) opportunity source + type values for the
 * caller's org, grouped by kind. Used by the opportunity form / filter chips
 * so admins can rename or add new options without redeploying.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'read')

    const rows = await useDrizzle()
      .select({
        kind: crmLookupValues.kind,
        key: crmLookupValues.key,
        label: crmLookupValues.label,
      })
      .from(crmLookupValues)
      .where(
        and(
          eq(crmLookupValues.organizationId, ctx.organizationId),
          isNull(crmLookupValues.archivedAt)
        )
      )
      .orderBy(asc(crmLookupValues.sortOrder), asc(crmLookupValues.label))

    const sources = rows.filter((r) => r.kind === 'opportunity_source')
    const types = rows.filter((r) => r.kind === 'opportunity_type')
    return { sources, types }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching opportunity lookup values', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
