import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { jobVacancies } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { vacancyUpdateSchema } from '@@/shared/schemas/hr'

/** HR-02 — edit a vacancy / change its status. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    const body = await readValidatedBody(event, vacancyUpdateSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: jobVacancies.id })
      .from(jobVacancies)
      .where(and(eq(jobVacancies.id, id), eq(jobVacancies.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Vacancy not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    for (const k of [
      'title',
      'department',
      'description',
      'employmentType',
      'location',
      'openings',
      'status',
    ] as const) {
      if (body[k] !== undefined) updates[k] = body[k]
    }
    if (body.closingDate !== undefined) updates.closingDate = body.closingDate ?? null

    const [updated] = await db
      .update(jobVacancies)
      .set(updates)
      .where(eq(jobVacancies.id, id))
      .returning()
    return { success: true, vacancy: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating vacancy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
