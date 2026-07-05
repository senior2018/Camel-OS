import { consola } from 'consola'
import { and, desc, eq, exists, inArray, or, sql } from 'drizzle-orm'

import {
  clients,
  projectMembers,
  projectMilestones,
  projects,
  users,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'
import { canOverseeProjects } from '@@/server/utils/project-settings'

/**
 * Projects list. Shared by the Project Management module and the CRM donor-link
 * picker, so either `project:read` or `crm:read` is accepted.
 *
 * Need-to-know by default: a user sees only projects they own (PM), created, or
 * are a team member on. Oversight (system admin / `project:admin`) sees all; the
 * CRM picker passes `?all=1` and is honoured for CRM users who must link any
 * project to a donor.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['project', 'read'],
      ['crm', 'read'],
    ])
    const db = useDrizzle()

    const canViewAll = await canOverseeProjects(ctx.userId, ctx.isSystemAdmin)
    const pickerAll =
      getQuery(event).all === '1' && (await userHasPermission(ctx.userId, 'crm', 'read'))
    const memberOrOwner = or(
      eq(projects.projectManagerUserId, ctx.userId),
      eq(projects.createdByUserId, ctx.userId),
      exists(
        db
          .select({ one: projectMembers.projectId })
          .from(projectMembers)
          .where(
            and(eq(projectMembers.projectId, projects.id), eq(projectMembers.userId, ctx.userId))
          )
      )
    )
    const scope =
      canViewAll || pickerAll
        ? eq(projects.organizationId, ctx.organizationId)
        : and(eq(projects.organizationId, ctx.organizationId), memberOrOwner)

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
      .where(scope)
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
