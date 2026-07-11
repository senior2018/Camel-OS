import { consola } from 'consola'
import { desc, eq, sql } from 'drizzle-orm'

import { jobApplicants, jobVacancies } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HR-02 — job vacancies with applicant counts. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'read')
    const rows = await useDrizzle()
      .select({
        id: jobVacancies.id,
        title: jobVacancies.title,
        department: jobVacancies.department,
        employmentType: jobVacancies.employmentType,
        location: jobVacancies.location,
        openings: jobVacancies.openings,
        status: jobVacancies.status,
        closingDate: jobVacancies.closingDate,
        applicantCount: sql<number>`count(${jobApplicants.id})::int`,
      })
      .from(jobVacancies)
      .leftJoin(jobApplicants, eq(jobApplicants.vacancyId, jobVacancies.id))
      .where(eq(jobVacancies.organizationId, ctx.organizationId))
      .groupBy(jobVacancies.id)
      .orderBy(desc(jobVacancies.createdAt))
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing vacancies', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
