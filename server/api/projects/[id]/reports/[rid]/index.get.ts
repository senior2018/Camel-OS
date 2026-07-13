import { consola } from 'consola'
import { aliasedTable, and, eq, inArray } from 'drizzle-orm'

import { projectActivities, projectReports, projects, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam } from '@@/server/utils/project-settings'

/** PJ-09 / P17 — a single report for the editor, with references + permissions. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    const rid = getRouterParam(event, 'rid')
    if (!id || !rid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const db = useDrizzle()

    const author = aliasedTable(users, 'author')
    const approver = aliasedTable(users, 'approver')
    const [row] = await db
      .select({
        report: projectReports,
        authorFirstName: author.firstName,
        authorLastName: author.lastName,
        approverFirstName: approver.firstName,
        approverLastName: approver.lastName,
        pmUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
      })
      .from(projectReports)
      .innerJoin(projects, eq(projects.id, projectReports.projectId))
      .leftJoin(author, eq(author.id, projectReports.authorUserId))
      .leftJoin(approver, eq(approver.id, projectReports.approverUserId))
      .where(
        and(
          eq(projectReports.id, rid),
          eq(projectReports.projectId, id),
          eq(projectReports.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Report not found' })

    const isLead = await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, {
      projectManagerUserId: row.pmUserId,
      createdByUserId: row.createdByUserId,
    })
    const isAuthor = row.report.authorUserId === ctx.userId
    const isApprover = row.report.approverUserId === ctx.userId

    // Visibility: author, lead, the assigned approver, or (general + shared) any
    // reader may view.
    const visible =
      isLead ||
      isAuthor ||
      isApprover ||
      (row.report.kind === 'general' && row.report.visibleToMembers)
    if (!visible) {
      throw createError({ statusCode: 403, statusMessage: 'You cannot view this report.' })
    }

    // Names of the activities an activity-report covers.
    const ids = row.report.activityIds ?? []
    const linkedActivities = ids.length
      ? await db
          .select({ id: projectActivities.id, name: projectActivities.name })
          .from(projectActivities)
          .where(and(eq(projectActivities.projectId, id), inArray(projectActivities.id, ids)))
      : []

    // For the general report, list submitted activity reports to reference.
    const submittedReports =
      row.report.kind === 'general' && isLead
        ? await db
            .select({
              id: projectReports.id,
              title: projectReports.title,
              authorFirstName: author.firstName,
              authorLastName: author.lastName,
            })
            .from(projectReports)
            .leftJoin(author, eq(author.id, projectReports.authorUserId))
            .where(
              and(
                eq(projectReports.projectId, id),
                eq(projectReports.kind, 'activity'),
                eq(projectReports.status, 'in_review')
              )
            )
        : []

    const canWrite =
      (isAuthor || (row.report.kind === 'general' && isLead)) && row.report.status === 'draft'
    const canApprove =
      row.report.kind === 'general' && row.report.status === 'in_review' && (isApprover || isLead)

    return {
      report: {
        ...row.report,
        authorName: [row.authorFirstName, row.authorLastName].filter(Boolean).join(' ') || null,
        approverName:
          [row.approverFirstName, row.approverLastName].filter(Boolean).join(' ') || null,
        linkedActivities,
      },
      submittedReports: submittedReports.map((r) => ({
        id: r.id,
        title: r.title,
        authorName: [r.authorFirstName, r.authorLastName].filter(Boolean).join(' ') || '—',
      })),
      permissions: {
        isLead,
        isAuthor,
        isApprover,
        canWrite,
        canSubmit: isAuthor && row.report.status === 'draft',
        canApprove,
        canRecall: (isAuthor || isLead) && row.report.status !== 'draft',
        canConfigure: isLead && row.report.kind === 'general',
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
