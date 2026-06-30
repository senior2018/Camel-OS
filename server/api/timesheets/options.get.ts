import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { projectActivities, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'

/** TS-01 — projects (+ their activities) available to log time against. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const db = useDrizzle()

    const projectRows = await db
      .select({ id: projects.id, name: projects.name })
      .from(projects)
      .where(eq(projects.organizationId, ctx.organizationId))
      .orderBy(asc(projects.name))

    const activityRows = await db
      .select({
        id: projectActivities.id,
        name: projectActivities.name,
        projectId: projectActivities.projectId,
      })
      .from(projectActivities)
      .where(eq(projectActivities.organizationId, ctx.organizationId))
      .orderBy(asc(projectActivities.name))

    return {
      projects: projectRows.map((p) => ({
        ...p,
        activities: activityRows
          .filter((a) => a.projectId === p.id)
          .map((a) => ({ id: a.id, name: a.name })),
      })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading timesheet options', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
