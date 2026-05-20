import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateClientSchema } from '@@/shared/schemas/client'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Client id is required' })

    const parsed = updateClientSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid client payload',
      })
    }

    const data = parsed.data
    const now = new Date()
    const updates: Record<string, unknown> = { updatedAt: now }
    if (data.name !== undefined) updates.name = data.name
    if (data.type !== undefined) updates.type = data.type
    if (data.industry !== undefined) updates.industry = data.industry ?? null
    if (data.country !== undefined) updates.country = data.country ?? null
    if (data.website !== undefined) updates.website = data.website ?? null
    if (data.phone !== undefined) updates.phone = data.phone ?? null
    if (data.email !== undefined) updates.email = data.email ?? null
    if (data.notes !== undefined) updates.notes = data.notes ?? null
    if (data.ownerUserId !== undefined) updates.ownerUserId = data.ownerUserId ?? null

    const [updated] = await useDrizzle()
      .update(clients)
      .set(updates)
      .where(and(eq(clients.id, id), eq(clients.organizationId, ctx.organizationId)))
      .returning()

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Client not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'update',
      resourceId: updated.id,
      meta: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
    })

    return { success: true, client: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating client', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
