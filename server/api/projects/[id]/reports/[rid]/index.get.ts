import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectReports, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** PJ-09 — a single report (for the editor). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const rid = getRouterParam(event, 'rid')
    if (!rid) throw createError({ statusCode: 400, statusMessage: 'Report ID is required' })
    const [report] = await useDrizzle()
      .select({
        id: projectReports.id,
        projectId: projectReports.projectId,
        title: projectReports.title,
        content: projectReports.content,
        status: projectReports.status,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        updatedAt: projectReports.updatedAt,
      })
      .from(projectReports)
      .leftJoin(users, eq(users.id, projectReports.authorUserId))
      .where(and(eq(projectReports.id, rid), eq(projectReports.organizationId, ctx.organizationId)))
      .limit(1)
    if (!report) throw createError({ statusCode: 404, statusMessage: 'Report not found' })
    return { report }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
