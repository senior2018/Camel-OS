import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { deriveClientName, updateClientSchema } from '@@/shared/schemas/client'

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
    const db = useDrizzle()

    // Pull the current row so we can re-derive `name` when any of the
    // structured pieces change (firstName / lastName / organization).
    const [existing] = await db
      .select({
        firstName: clients.firstName,
        lastName: clients.lastName,
        organization: clients.organization,
      })
      .from(clients)
      .where(and(eq(clients.id, id), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Client not found' })
    }

    const updates: Record<string, unknown> = { updatedAt: now }
    let nameComponentsTouched = false
    if (data.firstName !== undefined) {
      updates.firstName = data.firstName ?? null
      nameComponentsTouched = true
    }
    if (data.lastName !== undefined) {
      updates.lastName = data.lastName ?? null
      nameComponentsTouched = true
    }
    if (data.organization !== undefined) {
      updates.organization = data.organization ?? null
      nameComponentsTouched = true
    }
    if (nameComponentsTouched) {
      updates.name = deriveClientName({
        firstName: (updates.firstName as string | null | undefined) ?? existing.firstName,
        lastName: (updates.lastName as string | null | undefined) ?? existing.lastName,
        organization: (updates.organization as string | null | undefined) ?? existing.organization,
      })
    }

    if (data.type !== undefined) updates.type = data.type
    if (data.industry !== undefined) updates.industry = data.industry ?? null
    if (data.country !== undefined) updates.country = data.country ?? null
    if (data.website !== undefined) updates.website = data.website ?? null
    if (data.phone !== undefined) updates.phone = data.phone ?? null
    if (data.email !== undefined) updates.email = data.email ?? null
    if (data.notes !== undefined) updates.notes = data.notes ?? null
    if (data.metadata !== undefined) updates.metadata = data.metadata ?? null
    if (data.ownerUserId !== undefined) updates.ownerUserId = data.ownerUserId ?? null

    const [updated] = await db
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
