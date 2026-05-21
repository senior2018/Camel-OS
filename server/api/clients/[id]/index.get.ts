import { consola } from 'consola'
import { and, asc, desc, eq } from 'drizzle-orm'

import {
  clientContacts,
  clientInteractions,
  clientReminders,
  clients,
  donorGrants,
  opportunities,
  opportunityClients,
  users,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * Returns the full client detail bundle: profile + owner, all contacts, recent
 * interactions, linked opportunities (with total value), and pending reminders.
 * The detail page renders without any follow-up requests.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'read')

    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Client id is required' })

    const db = useDrizzle()

    const [client] = await db
      .select({
        id: clients.id,
        name: clients.name,
        type: clients.type,
        industry: clients.industry,
        country: clients.country,
        website: clients.website,
        phone: clients.phone,
        email: clients.email,
        notes: clients.notes,
        metadata: clients.metadata,
        ownerUserId: clients.ownerUserId,
        ownerEmail: users.email,
        ownerFirstName: users.firstName,
        ownerLastName: users.lastName,
        createdByUserId: clients.createdByUserId,
        createdAt: clients.createdAt,
        updatedAt: clients.updatedAt,
      })
      .from(clients)
      .leftJoin(users, eq(users.id, clients.ownerUserId))
      .where(and(eq(clients.id, id), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)

    if (!client) {
      throw createError({ statusCode: 404, statusMessage: 'Client not found' })
    }

    const contacts = await db
      .select()
      .from(clientContacts)
      .where(eq(clientContacts.clientId, client.id))
      .orderBy(desc(clientContacts.isPrimary), asc(clientContacts.firstName))

    const interactions = await db
      .select({
        id: clientInteractions.id,
        type: clientInteractions.type,
        occurredAt: clientInteractions.occurredAt,
        summary: clientInteractions.summary,
        followUpAt: clientInteractions.followUpAt,
        followUpAction: clientInteractions.followUpAction,
        contactId: clientInteractions.contactId,
        createdByUserId: clientInteractions.createdByUserId,
        createdAt: clientInteractions.createdAt,
        createdByFirstName: users.firstName,
        createdByLastName: users.lastName,
        createdByEmail: users.email,
      })
      .from(clientInteractions)
      .leftJoin(users, eq(users.id, clientInteractions.createdByUserId))
      .where(eq(clientInteractions.clientId, client.id))
      .orderBy(desc(clientInteractions.occurredAt))

    const linkedOpportunities = await db
      .select({
        opportunityId: opportunities.id,
        title: opportunities.title,
        stage: opportunities.stage,
        estimatedValue: opportunities.estimatedValue,
        currency: opportunities.currency,
        deadline: opportunities.deadline,
        isPrimary: opportunityClients.isPrimary,
      })
      .from(opportunityClients)
      .innerJoin(opportunities, eq(opportunities.id, opportunityClients.opportunityId))
      .where(eq(opportunityClients.clientId, client.id))
      .orderBy(desc(opportunityClients.isPrimary), desc(opportunities.updatedAt))

    const reminders = await db
      .select({
        id: clientReminders.id,
        dueAt: clientReminders.dueAt,
        message: clientReminders.message,
        completedAt: clientReminders.completedAt,
        assignedUserId: clientReminders.assignedUserId,
        contactId: clientReminders.contactId,
        createdAt: clientReminders.createdAt,
        assignedFirstName: users.firstName,
        assignedLastName: users.lastName,
        assignedEmail: users.email,
      })
      .from(clientReminders)
      .leftJoin(users, eq(users.id, clientReminders.assignedUserId))
      .where(eq(clientReminders.clientId, client.id))
      .orderBy(asc(clientReminders.completedAt), asc(clientReminders.dueAt))

    // Donor grants (CR-09) — only returned when the client is a donor. The UI
    // hides the grants card otherwise, so an empty array would just be noise.
    const grants =
      client.type === 'donor'
        ? await db
            .select()
            .from(donorGrants)
            .where(eq(donorGrants.donorId, client.id))
            .orderBy(asc(donorGrants.endDate), desc(donorGrants.createdAt))
        : []

    return { client, contacts, interactions, linkedOpportunities, reminders, grants }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error fetching client', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
