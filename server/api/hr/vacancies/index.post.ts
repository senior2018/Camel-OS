import { consola } from 'consola'

import { jobVacancies } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { vacancySchema } from '@@/shared/schemas/hr'

/** HR-02 — post a job vacancy. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'create')
    const body = await readValidatedBody(event, vacancySchema.parse)
    const [created] = await useDrizzle()
      .insert(jobVacancies)
      .values({
        organizationId: ctx.organizationId,
        title: body.title,
        department: body.department ?? null,
        description: body.description ?? null,
        employmentType: body.employmentType,
        location: body.location ?? null,
        openings: body.openings,
        status: body.status,
        closingDate: body.closingDate ?? null,
        postedByUserId: ctx.userId,
      })
      .returning()
    return { success: true, vacancy: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating vacancy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
