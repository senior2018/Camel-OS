import { consola } from 'consola'
import { and, eq, ne } from 'drizzle-orm'

import { clientContacts } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateContactSchema } from '@@/shared/schemas/client'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    const contactId = getRouterParam(event, 'contactId')
    if (!clientId || !contactId) {
      throw createError({ statusCode: 400, statusMessage: 'Client and contact ids are required' })
    }

    const parsed = updateContactSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid contact payload',
      })
    }

    const data = parsed.data
    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.firstName !== undefined) updates.firstName = data.firstName
    if (data.lastName !== undefined) updates.lastName = data.lastName ?? null
    if (data.title !== undefined) updates.title = data.title ?? null
    if (data.email !== undefined) updates.email = data.email ?? null
    if (data.phone !== undefined) updates.phone = data.phone ?? null
    if (data.isPrimary !== undefined) updates.isPrimary = data.isPrimary

    const updated = await useDrizzle().transaction(async (tx) => {
      // Demote the previous primary if we're promoting this one.
      if (data.isPrimary) {
        await tx
          .update(clientContacts)
          .set({ isPrimary: false })
          .where(
            and(
              eq(clientContacts.clientId, clientId),
              ne(clientContacts.id, contactId),
              eq(clientContacts.organizationId, ctx.organizationId)
            )
          )
      }
      const [row] = await tx
        .update(clientContacts)
        .set(updates)
        .where(
          and(
            eq(clientContacts.id, contactId),
            eq(clientContacts.clientId, clientId),
            eq(clientContacts.organizationId, ctx.organizationId)
          )
        )
        .returning()
      return row
    })

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Contact not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'contact_updated',
      resourceId: clientId,
      meta: { contactId: updated.id },
    })

    return { success: true, contact: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating contact', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
