import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clientInteractions } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateInteractionSchema } from '@@/shared/schemas/client'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    const interactionId = getRouterParam(event, 'interactionId')
    if (!clientId || !interactionId) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Client and interaction ids are required',
      })
    }

    const parsed = updateInteractionSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid interaction payload',
      })
    }

    const data = parsed.data
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.contactId !== undefined) updates.contactId = data.contactId ?? null
    if (data.type !== undefined) updates.type = data.type
    if (data.occurredAt !== undefined) updates.occurredAt = new Date(data.occurredAt)
    if (data.summary !== undefined) updates.summary = data.summary
    if (data.followUpAt !== undefined) updates.followUpAt = data.followUpAt ?? null
    if (data.followUpAction !== undefined) updates.followUpAction = data.followUpAction ?? null

    const [updated] = await useDrizzle()
      .update(clientInteractions)
      .set(updates)
      .where(
        and(
          eq(clientInteractions.id, interactionId),
          eq(clientInteractions.clientId, clientId),
          eq(clientInteractions.organizationId, ctx.organizationId)
        )
      )
      .returning()

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Interaction not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'interaction_updated',
      resourceId: clientId,
      meta: { interactionId: updated.id },
    })

    return { success: true, interaction: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating interaction', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
