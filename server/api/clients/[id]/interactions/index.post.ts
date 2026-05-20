import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clientInteractions, clients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createInteractionSchema } from '@@/shared/schemas/client'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    if (!clientId) throw createError({ statusCode: 400, statusMessage: 'Client id is required' })

    const parsed = createInteractionSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid interaction payload',
      })
    }

    const data = parsed.data
    const db = useDrizzle()

    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)
    if (!client) throw createError({ statusCode: 404, statusMessage: 'Client not found' })

    const [created] = await db
      .insert(clientInteractions)
      .values({
        clientId,
        organizationId: ctx.organizationId,
        contactId: data.contactId ?? null,
        type: data.type,
        occurredAt: new Date(data.occurredAt),
        summary: data.summary,
        followUpAt: data.followUpAt ?? null,
        followUpAction: data.followUpAction ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    if (!created) throw new Error('Failed to log interaction')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'interaction_logged',
      resourceId: clientId,
      meta: { interactionId: created.id, type: created.type },
    })

    return { success: true, interaction: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error logging interaction', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
