import { consola } from 'consola'

import { crmLookupValues } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createLookupSchema } from '@@/shared/schemas/lookup'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const parsed = createLookupSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }

    const data = parsed.data
    const db = useDrizzle()

    const [created] = await db
      .insert(crmLookupValues)
      .values({
        organizationId: admin.organizationId,
        kind: data.kind,
        key: data.key,
        label: data.label,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning()

    if (!created) throw new Error('Failed to create lookup value')

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'lookup_value',
      action: 'create',
      resourceId: created.id,
      meta: { kind: created.kind, key: created.key, label: created.label },
    })

    return { success: true, value: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    // Unique-constraint violation = duplicate key for this kind in this org.
    const code = (error as { code?: string })?.code
    if (code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'A value with that key already exists for this kind.',
      })
    }
    consola.error('Error creating lookup value', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
