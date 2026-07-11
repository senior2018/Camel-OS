import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { certifications, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { certificationSchema } from '@@/shared/schemas/hr'

/** HR-07 — record a certification or training for a staff member. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const body = await readValidatedBody(event, certificationSchema.parse)
    const db = useDrizzle()

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.id, body.userId), eq(users.organizationId, ctx.organizationId)))
      .limit(1)
    if (!user) throw createError({ statusCode: 404, statusMessage: 'Employee not found' })

    const [created] = await db
      .insert(certifications)
      .values({
        organizationId: ctx.organizationId,
        userId: body.userId,
        name: body.name,
        issuer: body.issuer ?? null,
        kind: body.kind,
        issuedDate: body.issuedDate ?? null,
        expiryDate: body.expiryDate ?? null,
        credentialId: body.credentialId ?? null,
        notes: body.notes ?? null,
      })
      .returning()
    return { success: true, certification: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding certification', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
