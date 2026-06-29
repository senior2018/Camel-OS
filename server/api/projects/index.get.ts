import { consola } from 'consola'
import { and, desc, eq, inArray, sql } from 'drizzle-orm'

import { clients, projectMilestones, projects, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'

/**
 * Projects list. Shared by the Project Management module and the CRM donor-link
 * picker, so either `project:read` or `crm:read` is accepted. Returns the PM,
 * client, and milestone progress so the list reads richly.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['project', 'read'],
      ['crm', 'read'],
    ])
    const db = useDrizzle()

    const items = await db
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        totalBudget: projects.totalBudget,
        currency: projects.currency,
        clientId: projects.clientId,
        clientName: clients.name,
        projectManagerUserId: projects.projectManagerUserId,
        pmFirstName: users.firstName,
        pmLastName: users.lastName,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .leftJoin(users, eq(users.id, projects.projectManagerUserId))
      .where(eq(projects.organizationId, ctx.organizationId))
      .orderBy(desc(projects.createdAt))

    // Milestone progress per project (done vs total).
    const ids = items.map((p) => p.id)
    const progress = ids.length
      ? await db
          .select({
            projectId: projectMilestones.projectId,
            total: sql<number>`count(*)::int`,
            done: sql<number>`count(*) filter (where ${projectMilestones.status} = 'completed')::int`,
          })
          .from(projectMilestones)
          .where(
            and(
              eq(projectMilestones.organizationId, ctx.organizationId),
              inArray(projectMilestones.projectId, ids)
            )
          )
          .groupBy(projectMilestones.projectId)
      : []
    const byProject = new Map(progress.map((p) => [p.projectId, p]))

    return {
      items: items.map((p) => ({
        ...p,
        milestonesTotal: byProject.get(p.id)?.total ?? 0,
        milestonesDone: byProject.get(p.id)?.done ?? 0,
      })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing projects', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
