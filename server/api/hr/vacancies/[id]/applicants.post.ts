import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { jobApplicants, jobVacancies } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { applicantSchema } from '@@/shared/schemas/hr'

/** HR-02 — add an applicant to a vacancy. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, applicantSchema.parse)
    const db = useDrizzle()

    const [vacancy] = await db
      .select({ id: jobVacancies.id })
      .from(jobVacancies)
      .where(and(eq(jobVacancies.id, id), eq(jobVacancies.organizationId, ctx.organizationId)))
      .limit(1)
    if (!vacancy) throw createError({ statusCode: 404, statusMessage: 'Vacancy not found' })

    const [created] = await db
      .insert(jobApplicants)
      .values({
        organizationId: ctx.organizationId,
        vacancyId: id,
        name: body.name,
        email: body.email || null,
        phone: body.phone ?? null,
        cvUrl: body.cvUrl || null,
        stage: body.stage,
        rating: body.rating ?? null,
        notes: body.notes ?? null,
      })
      .returning()
    return { success: true, applicant: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error adding applicant', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
