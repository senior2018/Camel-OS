import { consola } from 'consola'
import { and, asc, eq } from 'drizzle-orm'

import { jobApplicants, jobVacancies } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HR-02 — a vacancy with its applicant pipeline. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const db = useDrizzle()

    const [vacancy] = await db
      .select()
      .from(jobVacancies)
      .where(and(eq(jobVacancies.id, id), eq(jobVacancies.organizationId, ctx.organizationId)))
      .limit(1)
    if (!vacancy) throw createError({ statusCode: 404, statusMessage: 'Vacancy not found' })

    const applicants = await db
      .select()
      .from(jobApplicants)
      .where(eq(jobApplicants.vacancyId, id))
      .orderBy(asc(jobApplicants.createdAt))
    return { vacancy, applicants }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading vacancy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
