import { consola } from 'consola'

import { opportunities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createOpportunitySchema } from '@@/shared/schemas/opportunity'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'create')

    const parsed = createOpportunitySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid opportunity payload',
      })
    }

    const data = parsed.data

    const [created] = await useDrizzle()
      .insert(opportunities)
      .values({
        organizationId: ctx.organizationId,
        title: data.title,
        description: data.description ?? null,
        source: data.source,
        type: data.type,
        deadline: data.deadline ?? null,
        estimatedValue: data.estimatedValue ?? null,
        currency: data.currency,
        winProbability: data.winProbability ?? null,
        tags: data.tags && data.tags.length > 0 ? data.tags : null,
        ownerUserId: data.ownerUserId ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    if (!created) throw new Error('Failed to create opportunity')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'create',
      resourceId: created.id,
      meta: { title: created.title, source: created.source, type: created.type },
    })

    return { success: true, opportunity: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating opportunity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
