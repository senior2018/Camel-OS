import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { crmLookupValues } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateLookupSchema } from '@@/shared/schemas/lookup'

/**
 * Edits a lookup value. Admins can rename the label, adjust sort order, or
 * archive/un-archive the value. The `key` is immutable — opportunities still
 * reference it on existing rows, so renaming it would orphan them.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })

    const parsed = updateLookupSchema.safeParse(await readBody(event))
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
        and(eq(crmLookupValues.id, id), eq(crmLookupValues.organizationId, admin.organizationId))
      )
      .returning()

    if (!updated) throw createError({ statusCode: 404, statusMessage: 'Value not found' })

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'lookup_value',
      action: 'update',
      resourceId: updated.id,
      meta: { kind: updated.kind, key: updated.key, fields: Object.keys(updates) },
    })

    return { success: true, value: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating lookup value', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
