import { consola } from 'consola'
import { and, asc, eq, inArray, sql } from 'drizzle-orm'

import { contentItems, crmLookupValues } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { CONTENT_LOOKUP_KINDS } from '@@/shared/schemas/communication-settings'

/**
 * Lists the org's configurable communications vocabularies (content types and
 * categories) with a live usage count from `content_items`, so a leader can see
 * whether a value is safe to delete. Editable by the communications leader
 * (communications:admin) or an org admin.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['communications', 'admin'],
      ['admin', 'admin'],
    ])

    const db = useDrizzle()

    // Correlated count: match content_items on the column that corresponds to
    // each lookup kind. `type` stores the machine key; `category` is free-text
    // and stores the human label — so each is matched on its own column.
    const usageCount = sql<number>`(
      SELECT COUNT(*)::int FROM ${contentItems}
      WHERE ${contentItems.organizationId} = ${crmLookupValues.organizationId}
        AND (
          (${crmLookupValues.kind} = 'content_type' AND ${contentItems.type} = ${crmLookupValues.key})
          OR
          (${crmLookupValues.kind} = 'content_category' AND ${contentItems.category} = ${crmLookupValues.label})
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
        usageCount,
      })
      .from(crmLookupValues)
      .where(
        and(
          eq(crmLookupValues.organizationId, ctx.organizationId),
          inArray(crmLookupValues.kind, [...CONTENT_LOOKUP_KINDS])
        )
      )
      .orderBy(
        asc(crmLookupValues.kind),
        asc(crmLookupValues.sortOrder),
        asc(crmLookupValues.label)
      )

    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing communications lookups', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
