import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projects, timesheetEntries } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { timesheetEntrySchema } from '@@/shared/schemas/project'

/** PJ-06 — log hours against the project / an activity (the caller's own time). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, timesheetEntrySchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    await db.insert(timesheetEntries).values({
      organizationId: ctx.organizationId,
      projectId: id,
      activityId: body.activityId ?? null,
      userId: ctx.userId,
      entryDate: body.entryDate,
      hours: String(body.hours),
      note: body.note ?? null,
    })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error logging time', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
