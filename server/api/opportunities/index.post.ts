import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { clients, opportunities, opportunityClients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { notifyOpportunityOwnerAssignment } from '@@/server/utils/opportunity-notify'
import { createOpportunitySchema } from '@@/shared/schemas/opportunity'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'create')

    const parsed = createOpportunitySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid opportunity payload',
      })
    }

    const data = parsed.data

    const db = useDrizzle()

    const created = await db.transaction(async (tx) => {
      const [opp] = await tx
        .insert(opportunities)
        .values({
          organizationId: ctx.organizationId,
          title: data.title,
          source: data.source,
          type: data.type,
          deadline: data.deadline ?? null,
          estimatedValue: data.estimatedValue ?? null,
          currency: data.currency,
          ownerUserId: data.ownerUserId ?? null,
          createdByUserId: ctx.userId,
        })
        .returning()
      if (!opp) throw new Error('Failed to create opportunity')

      // CR-03: link the chosen primary client. Validate it belongs to this org
      // before inserting so a malicious id can't leak across tenants.
      if (data.primaryClientId) {
        const [client] = await tx
          .select({ id: clients.id })
          .from(clients)
          .where(
            and(
              eq(clients.id, data.primaryClientId),
              eq(clients.organizationId, ctx.organizationId)
            )
          )
          .limit(1)
        if (client) {
          await tx.insert(opportunityClients).values({
            opportunityId: opp.id,
            clientId: data.primaryClientId,
            organizationId: ctx.organizationId,
            isPrimary: true,
          })
        }
      }
      return opp
    })

    if (!created) throw new Error('Failed to create opportunity')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'create',
      resourceId: created.id,
      meta: { title: created.title, source: created.source, type: created.type },
    })

    if (created.ownerUserId && created.ownerUserId !== ctx.userId) {
      await notifyOpportunityOwnerAssignment(created.ownerUserId, ctx.userId, created)
    }

    return { success: true, opportunity: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating opportunity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
