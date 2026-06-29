import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectReports, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { projectReportSchema } from '@@/shared/schemas/project'

/** PJ-09 — start a project report from the standard template. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readValidatedBody(event, projectReportSchema.parse)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const [created] = await db
      .insert(projectReports)
      .values({
        projectId: id,
        organizationId: ctx.organizationId,
        title: body.title,
        content: body.content ?? null,
        status: 'draft',
        authorUserId: ctx.userId,
      })
      .returning()
    return { success: true, report: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
