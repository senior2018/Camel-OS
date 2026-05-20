import { consola } from 'consola'
import { and, eq, ne } from 'drizzle-orm'

import { clients, opportunities, opportunityClients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { linkOpportunitySchema } from '@@/shared/schemas/client'

/**
 * Link an existing opportunity to this client (CR-03). The pivot uses
 * (opportunityId, clientId) as its composite PK so re-posting the same link is
 * a 409 — callers should `PATCH` to change `isPrimary`. We don't expose that
 * here yet because the only mutation the UI does today is link + unlink.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'update')
    const clientId = getRouterParam(event, 'id')
    if (!clientId) throw createError({ statusCode: 400, statusMessage: 'Client id is required' })

    const parsed = linkOpportunitySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid link payload',
      })
    }

    const { opportunityId, isPrimary } = parsed.data
    const db = useDrizzle()

    // Verify both records belong to the caller's org before linking.
    const [client] = await db
      .select({ id: clients.id })
      .from(clients)
      .where(and(eq(clients.id, clientId), eq(clients.organizationId, ctx.organizationId)))
      .limit(1)
    if (!client) throw createError({ statusCode: 404, statusMessage: 'Client not found' })

    const [opp] = await db
      .select({ id: opportunities.id, title: opportunities.title })
      .from(opportunities)
      .where(
        and(
          eq(opportunities.id, opportunityId),
          eq(opportunities.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!opp) throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })

    await db.transaction(async (tx) => {
      // Only one primary client per opportunity — demote any existing primary.
      if (isPrimary) {
        await tx
          .update(opportunityClients)
          .set({ isPrimary: false })
          .where(
            and(
              eq(opportunityClients.opportunityId, opportunityId),
              ne(opportunityClients.clientId, clientId)
            )
          )
      }
      await tx
        .insert(opportunityClients)
        .values({
          opportunityId,
          clientId,
          organizationId: ctx.organizationId,
          isPrimary: isPrimary ?? false,
        })
        .onConflictDoUpdate({
          target: [opportunityClients.opportunityId, opportunityClients.clientId],
          set: { isPrimary: isPrimary ?? false },
        })
    })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'opportunity_linked',
      resourceId: clientId,
      meta: { opportunityId, opportunityTitle: opp.title, isPrimary: isPrimary ?? false },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error linking opportunity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
