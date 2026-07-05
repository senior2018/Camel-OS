import { consola } from 'consola'
import { and, count, eq, inArray } from 'drizzle-orm'

import { contentItems, crmLookupValues } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { CONTENT_LOOKUP_KINDS } from '@@/shared/schemas/communication-settings'

/**
 * Hard-deletes a content vocabulary value — only when NO content item references
 * it (otherwise historical rows would show an orphaned key). Archive instead.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['communications', 'admin'],
      ['admin', 'admin'],
    ])
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })

    const db = useDrizzle()

    const [target] = await db
      .select()
      .from(crmLookupValues)
      .where(
        and(
          eq(crmLookupValues.id, id),
          eq(crmLookupValues.organizationId, ctx.organizationId),
          inArray(crmLookupValues.kind, [...CONTENT_LOOKUP_KINDS])
        )
      )
      .limit(1)

    if (!target) throw createError({ statusCode: 404, statusMessage: 'Value not found' })

    const [{ used } = { used: 0 }] = await db
      .select({ used: count() })
      .from(contentItems)
      .where(
        and(
          eq(contentItems.organizationId, ctx.organizationId),
          target.kind === 'content_type'
            ? eq(contentItems.type, target.key)
            : eq(contentItems.category, target.label)
        )
      )

    if (used > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `${used} content item(s) use this value — archive it instead.`,
      })
    }

    await db.delete(crmLookupValues).where(eq(crmLookupValues.id, id))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'content_lookup_value',
      action: 'delete',
      resourceId: id,
      meta: { kind: target.kind, key: target.key, label: target.label },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting communications lookup', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
