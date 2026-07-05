import { consola } from 'consola'

import { crmLookupValues } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createContentLookupSchema } from '@@/shared/schemas/communication-settings'

/** Adds a content type or category. Leader (communications:admin) or org admin. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['communications', 'admin'],
      ['admin', 'admin'],
    ])

    const parsed = createContentLookupSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }
    const data = parsed.data

    const [created] = await useDrizzle()
      .insert(crmLookupValues)
      .values({
        organizationId: ctx.organizationId,
        kind: data.kind,
        key: data.key,
        label: data.label,
        sortOrder: data.sortOrder ?? 0,
      })
      .returning()

    if (!created) throw new Error('Failed to create lookup value')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'content_lookup_value',
      action: 'create',
      resourceId: created.id,
      meta: { kind: created.kind, key: created.key, label: created.label },
    })

    return { success: true, value: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    const code = (error as { code?: string })?.code
    if (code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'A value with that key already exists for this kind.',
      })
    }
    consola.error('Error creating communications lookup', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
