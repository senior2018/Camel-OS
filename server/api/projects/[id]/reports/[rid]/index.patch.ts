import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { projectReports } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { PROJECT_REPORT_STATUSES, projectReportSchema } from '@@/shared/schemas/project'

const patchSchema = projectReportSchema
  .partial()
  .extend({ status: z.enum(PROJECT_REPORT_STATUSES).optional() })

/** PJ-09 — edit a report or advance its draft → review → approved status. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const rid = getRouterParam(event, 'rid')
    if (!rid) throw createError({ statusCode: 400, statusMessage: 'Report ID is required' })
    const data = await readValidatedBody(event, patchSchema.parse)
    const db = useDrizzle()

    const [existing] = await db
      .select({ id: projectReports.id })
      .from(projectReports)
      .where(and(eq(projectReports.id, rid), eq(projectReports.organizationId, ctx.organizationId)))
      .limit(1)
    if (!existing) throw createError({ statusCode: 404, statusMessage: 'Report not found' })

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (data.title !== undefined) updates.title = data.title
    if (data.content !== undefined) updates.content = data.content ?? null
    if (data.status !== undefined) updates.status = data.status

    const [updated] = await db
      .update(projectReports)
      .set(updates)
      .where(eq(projectReports.id, rid))
      .returning()
    return { success: true, report: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
