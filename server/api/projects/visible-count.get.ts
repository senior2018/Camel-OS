import { consola } from 'consola'
import { and, count, eq, exists, or } from 'drizzle-orm'

import { projectMembers, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canOverseeProjects } from '@@/server/utils/project-settings'

/**
 * How many projects the caller can see under need-to-know, plus whether they
 * hold an oversight role. The dashboard uses this to hide the Projects nav from
 * users who have no project to see.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const db = useDrizzle()

    const canViewAll = await canOverseeProjects(ctx.userId, ctx.isSystemAdmin)
    const scope = canViewAll
      ? eq(projects.organizationId, ctx.organizationId)
      : and(
          eq(projects.organizationId, ctx.organizationId),
          or(
            eq(projects.projectManagerUserId, ctx.userId),
            eq(projects.createdByUserId, ctx.userId),
            exists(
              db
                .select({ one: projectMembers.projectId })
                .from(projectMembers)
                .where(
                  and(
                    eq(projectMembers.projectId, projects.id),
                    eq(projectMembers.userId, ctx.userId)
                  )
                )
            )
          )
        )

    const [row] = await db.select({ total: count() }).from(projects).where(scope)
    return { count: row?.total ?? 0, canViewAll }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error counting visible projects', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
