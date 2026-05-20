import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clientContacts } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    const contactId = getRouterParam(event, 'contactId')
    if (!clientId || !contactId) {
      throw createError({ statusCode: 400, statusMessage: 'Client and contact ids are required' })
    }

    const [deleted] = await useDrizzle()
      .delete(clientContacts)
      .where(
        and(
          eq(clientContacts.id, contactId),
          eq(clientContacts.clientId, clientId),
          eq(clientContacts.organizationId, ctx.organizationId)
        )
      )
      .returning({ id: clientContacts.id, firstName: clientContacts.firstName })

    if (!deleted) {
      throw createError({ statusCode: 404, statusMessage: 'Contact not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'contact_removed',
      resourceId: clientId,
      meta: { contactId: deleted.id, name: deleted.firstName },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting contact', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
