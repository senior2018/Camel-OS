import { consola } from 'consola'
import { and, eq, ilike } from 'drizzle-orm'

import { clients } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { createClientSchema, deriveClientName } from '@@/shared/schemas/client'

/**
 * Create a client/prospect (CR-01). Duplicate detection runs *before* the
 * insert: an exact (case-insensitive) email match OR an exact name match within
 * the same organization will block the create and return the existing IDs so the
 * UI can offer "open existing instead". Phone is intentionally excluded because
 * staff often record placeholders ("+255 ext 12") that false-positive.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'create')

    const parsed = createClientSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid client payload',
      })
    }

    const data = parsed.data
    // Compute the canonical display name from the structured fields.
    const displayName = deriveClientName({
      firstName: data.firstName,
      lastName: data.lastName,
      organization: data.organization,
    })
    const db = useDrizzle()

    const dupConds = [eq(clients.organizationId, ctx.organizationId)]
    const matches = await db
      .select({ id: clients.id, name: clients.name, email: clients.email })
      .from(clients)
      .where(
        and(
          ...dupConds,
          // Either an email match OR a case-insensitive name match counts as a dup.
          data.email ? eq(clients.email, data.email) : ilike(clients.name, displayName)
        )
      )
      .limit(5)

    // If we had an email, do a second name-only pass — `or` between an email
    // equality and an ilike isn't safe when email may be null on existing rows.
    if (data.email) {
      const nameMatches = await db
        .select({ id: clients.id, name: clients.name, email: clients.email })
        .from(clients)
        .where(
          and(eq(clients.organizationId, ctx.organizationId), ilike(clients.name, displayName))
        )
        .limit(5)
      for (const m of nameMatches) if (!matches.find((x) => x.id === m.id)) matches.push(m)
    }

    if (matches.length > 0) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A client with this name or email already exists',
        data: { duplicates: matches },
      })
    }

    const [created] = await db
      .insert(clients)
      .values({
        organizationId: ctx.organizationId,
        name: displayName,
        firstName: data.firstName ?? null,
        lastName: data.lastName ?? null,
        organization: data.organization ?? null,
        type: data.type,
        industry: data.industry ?? null,
        country: data.country ?? null,
        website: data.website ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        notes: data.notes ?? null,
        metadata: data.metadata ?? null,
        ownerUserId: data.ownerUserId ?? null,
        createdByUserId: ctx.userId,
      })
      .returning()

    if (!created) throw new Error('Failed to create client')

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'client',
      action: 'create',
      resourceId: created.id,
      meta: { name: created.name, type: created.type },
    })

    return { success: true, client: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating client', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
