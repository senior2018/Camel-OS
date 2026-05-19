import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { opportunities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateOpportunitySchema } from '@@/shared/schemas/opportunity'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const parsed = updateOpportunitySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid opportunity payload',
      })
    }

    const data = parsed.data
    const now = new Date()

    // Build partial update — only include fields the caller actually sent so we
    // don't accidentally clobber columns the form omitted.
    const updates: Record<string, unknown> = { updatedAt: now }
    if (data.title !== undefined) updates.title = data.title
    if (data.description !== undefined) updates.description = data.description
    if (data.source !== undefined) updates.source = data.source
    if (data.type !== undefined) updates.type = data.type
    if (data.deadline !== undefined) updates.deadline = data.deadline ?? null
    if (data.estimatedValue !== undefined) updates.estimatedValue = data.estimatedValue ?? null
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.winProbability !== undefined) updates.winProbability = data.winProbability ?? null
    if (data.tags !== undefined) updates.tags = data.tags && data.tags.length > 0 ? data.tags : null
    if (data.ownerUserId !== undefined) updates.ownerUserId = data.ownerUserId ?? null

    const [updated] = await useDrizzle()
      .update(opportunities)
      .set(updates)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .returning()

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'update',
      resourceId: updated.id,
      meta: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
    })

    return { success: true, opportunity: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating opportunity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
