import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { jobApplicants } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { applicantUpdateSchema } from '@@/shared/schemas/hr'

/** HR-02 — move an applicant through the pipeline / rate / annotate. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, applicantUpdateSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: jobApplicants.id })
      .from(jobApplicants)
      .where(and(eq(jobApplicants.id, id), eq(jobApplicants.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Applicant not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    for (const k of ['name', 'phone', 'stage', 'notes'] as const) {
      if (body[k] !== undefined) updates[k] = body[k]
    }
    if (body.email !== undefined) updates.email = body.email || null
    if (body.cvUrl !== undefined) updates.cvUrl = body.cvUrl || null
    if (body.rating !== undefined) updates.rating = body.rating ?? null

    const [updated] = await db
      .update(jobApplicants)
      .set(updates)
      .where(eq(jobApplicants.id, id))
      .returning()
    return { success: true, applicant: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating applicant', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
