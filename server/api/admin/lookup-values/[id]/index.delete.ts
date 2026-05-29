import { consola } from 'consola'
import { and, count, eq } from 'drizzle-orm'

import { crmLookupValues, opportunities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Hard-delete a lookup value — but only if NO existing opportunity references it.
 *
 * Why the guard: opportunities store the lookup key as plain text on
 * `opportunities.source` / `opportunities.type`. Deleting a referenced value
 * would leave dangling labels in historical records ("Source: ?", "Type: ?").
 * Admins facing that situation should Archive instead.
 *
 * The UI disables the Delete button + shows the count, so we shouldn't see
 * many 409s here. The server check is the authoritative guard regardless.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })

    const db = useDrizzle()

    const [target] = await db
      .select()
      .from(crmLookupValues)
      .where(
        and(eq(crmLookupValues.id, id), eq(crmLookupValues.organizationId, admin.organizationId))
      )
      .limit(1)
    if (!target) throw createError({ statusCode: 404, statusMessage: 'Value not found' })

    // Count opportunities still using this value on the appropriate column.
    const column = target.kind === 'opportunity_source' ? opportunities.source : opportunities.type
    const [row] = await db
      .select({ usage: count() })
      .from(opportunities)
      .where(and(eq(opportunities.organizationId, admin.organizationId), eq(column, target.key)))
    const usage = row?.usage ?? 0

    if (usage > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: `${usage} opportunit${usage === 1 ? 'y' : 'ies'} still use this value. Archive it instead.`,
      })
    }

    await db
      .delete(crmLookupValues)
      .where(
        and(eq(crmLookupValues.id, id), eq(crmLookupValues.organizationId, admin.organizationId))
      )

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'lookup_value',
      action: 'delete',
      resourceId: target.id,
      meta: { kind: target.kind, key: target.key, label: target.label },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting lookup value', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
