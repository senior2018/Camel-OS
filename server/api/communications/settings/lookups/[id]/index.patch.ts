import { consola } from 'consola'
import { and, eq, inArray } from 'drizzle-orm'

import { crmLookupValues } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import {
  CONTENT_LOOKUP_KINDS,
  updateContentLookupSchema,
} from '@@/shared/schemas/communication-settings'

/**
 * Renames / reorders / archives a content vocabulary value. The `key` is
 * immutable — existing content rows still reference it. Leader or admin.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['communications', 'admin'],
      ['admin', 'admin'],
    ])
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })

    const parsed = updateContentLookupSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.label !== undefined) updates.label = parsed.data.label
    if (parsed.data.sortOrder !== undefined) updates.sortOrder = parsed.data.sortOrder
    if (parsed.data.archived !== undefined) {
      updates.archivedAt = parsed.data.archived ? new Date() : null
    }

    const [updated] = await useDrizzle()
      .update(crmLookupValues)
      .set(updates)
      .where(
        and(
          eq(crmLookupValues.id, id),
          eq(crmLookupValues.organizationId, ctx.organizationId),
          inArray(crmLookupValues.kind, [...CONTENT_LOOKUP_KINDS])
        )
      )
      .returning()

    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Value not found' })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'content_lookup_value',
      action: 'update',
      resourceId: updated.id,
      meta: { kind: updated.kind, key: updated.key, label: updated.label },
    })

    return { success: true, value: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating communications lookup', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
