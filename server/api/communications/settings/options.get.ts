import { consola } from 'consola'
import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { crmLookupValues } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { CONTENT_TYPES, CONTENT_TYPE_LABEL } from '@@/shared/schemas/communication'
import { CONTENT_LOOKUP_KINDS } from '@@/shared/schemas/communication-settings'

/**
 * Active content-type and category options for the writing pickers. Merges the
 * built-in defaults (so every org has a working vocabulary out of the box) with
 * any org-defined values from settings, de-duplicated by key. Readable by any
 * content-team member; managed on the Settings page by a leader/admin.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['communications', 'read'],
      ['communications', 'create'],
      ['communications', 'update'],
      ['communications', 'approve'],
    ])

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
          inArray(crmLookupValues.kind, [...CONTENT_LOOKUP_KINDS]),
          isNull(crmLookupValues.archivedAt)
        )
      )
      .orderBy(asc(crmLookupValues.sortOrder), asc(crmLookupValues.label))

    // Built-in types are always available; org values extend/override by key.
    const typeMap = new Map<string, string>(CONTENT_TYPES.map((t) => [t, CONTENT_TYPE_LABEL[t]]))
    const categoryMap = new Map<string, string>()
    for (const r of rows) {
      if (r.kind === 'content_type') typeMap.set(r.key, r.label)
      else if (r.kind === 'content_category') categoryMap.set(r.key, r.label)
    }

    return {
      types: [...typeMap].map(([key, label]) => ({ key, label })),
      categories: [...categoryMap].map(([key, label]) => ({ key, label })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading communications options', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
