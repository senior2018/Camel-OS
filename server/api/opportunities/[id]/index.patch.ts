import { consola } from 'consola'
import { and, eq, ne } from 'drizzle-orm'

import { clients, opportunities, opportunityClients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { notifyOpportunityOwnerAssignment } from '@@/server/utils/opportunity-notify'
import { updateOpportunitySchema } from '@@/shared/schemas/opportunity'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const parsed = updateOpportunitySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid opportunity payload',
      })
    }

    const data = parsed.data
    const now = new Date()
    const db = useDrizzle()

    // Read current row so we can detect owner changes for OM-05 notifications.
    const [existing] = await db
      .select({ ownerUserId: opportunities.ownerUserId })
      .from(opportunities)
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    const updates: Record<string, unknown> = { updatedAt: now }
    if (data.title !== undefined) updates.title = data.title
    if (data.source !== undefined) updates.source = data.source
    if (data.type !== undefined) updates.type = data.type
    if (data.description !== undefined) updates.description = data.description ?? null
    if (data.tags !== undefined) updates.tags = data.tags ?? []
    if (data.winProbability !== undefined) updates.winProbability = data.winProbability ?? null
    if (data.deadline !== undefined) updates.deadline = data.deadline ?? null
    if (data.estimatedValue !== undefined) updates.estimatedValue = data.estimatedValue ?? null
    if (data.currency !== undefined) updates.currency = data.currency
    if (data.ownerUserId !== undefined) updates.ownerUserId = data.ownerUserId ?? null

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(opportunities)
        .set(updates)
        .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
        .returning()
      if (!row) return null

      // CR-03 primary-client mutation. `null` removes the primary link entirely
      // (the picker treats "No client" as unlink, not demote). A uuid promotes
      // that client (demoting any existing primary). `undefined` leaves links untouched.
      if (data.primaryClientId !== undefined) {
        if (data.primaryClientId === null) {
          // Delete only the current primary row. Secondary links (if any) stay.
          await tx
            .delete(opportunityClients)
            .where(
              and(eq(opportunityClients.opportunityId, id), eq(opportunityClients.isPrimary, true))
            )
        } else {
          // Demote any current primary so we can insert a new one cleanly.
          await tx
            .update(opportunityClients)
            .set({ isPrimary: false })
            .where(
              and(eq(opportunityClients.opportunityId, id), eq(opportunityClients.isPrimary, true))
            )
        }

        if (data.primaryClientId) {
          // Validate ownership, then upsert the link with isPrimary=true.
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
            await tx
              .insert(opportunityClients)
              .values({
                opportunityId: id,
                clientId: data.primaryClientId,
                organizationId: ctx.organizationId,
                isPrimary: true,
              })
              .onConflictDoUpdate({
                target: [opportunityClients.opportunityId, opportunityClients.clientId],
                set: { isPrimary: true },
              })
            // Ensure no *other* client is left primary (defensive — the prior
            // demote covers this, but a stale row from a half-applied migration
            // shouldn't slip through).
            await tx
              .update(opportunityClients)
              .set({ isPrimary: false })
              .where(
                and(
                  eq(opportunityClients.opportunityId, id),
                  ne(opportunityClients.clientId, data.primaryClientId)
                )
              )
          }
        }
      }
      return row
    })

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: 'update',
      resourceId: updated.id,
      meta: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
    })

    const ownerChanged =
      data.ownerUserId !== undefined && updated.ownerUserId !== existing.ownerUserId
    if (ownerChanged && updated.ownerUserId && updated.ownerUserId !== ctx.userId) {
      await notifyOpportunityOwnerAssignment(updated.ownerUserId, ctx.userId, updated)
    }

    return { success: true, opportunity: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating opportunity', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
