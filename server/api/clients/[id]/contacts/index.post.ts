import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clientContacts, clients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createContactSchema } from '@@/shared/schemas/client'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    if (!clientId) throw createError({ statusCode: 400, statusMessage: 'Client id is required' })

    const parsed = createContactSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid contact payload',
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

    const created = await db.transaction(async (tx) => {
      // If this contact is being flagged primary, unflag every existing primary
      // first — exactly one per client by app convention.
      if (data.isPrimary) {
        await tx
          .update(clientContacts)
          .set({ isPrimary: false })
          .where(eq(clientContacts.clientId, clientId))
      }

      const [row] = await tx
        .insert(clientContacts)
        .values({
          clientId,
          organizationId: ctx.organizationId,
          firstName: data.firstName,
          lastName: data.lastName ?? null,
          title: data.title ?? null,
          email: data.email ?? null,
          phone: data.phone ?? null,
          isPrimary: data.isPrimary ?? false,
        })
        .returning()
      return row
    })

    if (!created) throw new Error('Failed to create contact')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'contact_added',
      resourceId: clientId,
      meta: {
        contactId: created.id,
        name: [created.firstName, created.lastName].filter(Boolean).join(' '),
      },
    })

    return { success: true, contact: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating contact', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
