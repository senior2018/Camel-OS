import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { certifications } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { certificationSchema } from '@@/shared/schemas/hr'

/** HR-07 — edit a certification / training record. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const b = await readValidatedBody(event, certificationSchema.partial().parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: certifications.id })
      .from(certifications)
      .where(and(eq(certifications.id, id), eq(certifications.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Certification not found' })

    const u: Record<string, unknown> = {}
    if (b.name !== undefined) u.name = b.name
    if (b.issuer !== undefined) u.issuer = b.issuer ?? null
    if (b.kind !== undefined) u.kind = b.kind
    if (b.issuedDate !== undefined) u.issuedDate = b.issuedDate ?? null
    if (b.expiryDate !== undefined) u.expiryDate = b.expiryDate ?? null
    if (b.credentialId !== undefined) u.credentialId = b.credentialId ?? null
    if (b.notes !== undefined) u.notes = b.notes ?? null

    const [updated] = await db
      .update(certifications)
      .set(u)
      .where(eq(certifications.id, id))
      .returning()
    return { success: true, certification: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating certification', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
