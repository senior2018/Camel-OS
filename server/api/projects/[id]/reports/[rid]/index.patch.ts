import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projectReports, projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canManageProjectTeam } from '@@/server/utils/project-settings'
import { createNotifications } from '@@/server/utils/notifications'
import { updateProjectReportSchema } from '@@/shared/schemas/project'

/**
 * PJ-09 / P17 — edit a free-form report and drive its status. Activity reports
 * are submit-only (draft → submitted); the general report goes draft → review →
 * approved by its assigned approver (or the lead). No enforced sections (P12).
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    const rid = getRouterParam(event, 'rid')
    if (!id || !rid) throw createError({ statusCode: 400, statusMessage: 'IDs are required' })
    const data = await readValidatedBody(event, updateProjectReportSchema.parse)
    const db = useDrizzle()

    const [row] = await db
      .select({
        report: projectReports,
        pmUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
      })
      .from(projectReports)
      .innerJoin(projects, eq(projects.id, projectReports.projectId))
      .where(
        and(
          eq(projectReports.id, rid),
          eq(projectReports.projectId, id),
          eq(projectReports.organizationId, ctx.organizationId)
        )
      )
      .limit(1)
    if (!row) throw createError({ statusCode: 404, statusMessage: 'Report not found' })
    const report = row.report

    const isLead = await canManageProjectTeam(ctx.userId, ctx.isSystemAdmin, {
      projectManagerUserId: row.pmUserId,
      createdByUserId: row.createdByUserId,
    })
    const isAuthor = report.authorUserId === ctx.userId
    const isApprover = report.approverUserId === ctx.userId
    const canWrite =
      (isAuthor || (report.kind === 'general' && isLead)) && report.status === 'draft'

    const updates: Record<string, unknown> = { updatedAt: new Date() }

    // Content edits — only while writable.
    const editingContent =
      data.title !== undefined || data.content !== undefined || data.activityIds !== undefined
    if (editingContent) {
      if (!canWrite)
        throw createError({
          statusCode: 403,
          statusMessage: 'This report can no longer be edited.',
        })
      if (data.title !== undefined) updates.title = data.title
      if (data.content !== undefined) updates.content = data.content ?? null
      if (data.activityIds !== undefined) updates.activityIds = data.activityIds
    }

    // Configuration (approver + member visibility) — lead only, general report.
    if (data.visibleToMembers !== undefined || data.approverUserId !== undefined) {
      if (!isLead || report.kind !== 'general')
        throw createError({
          statusCode: 403,
          statusMessage: 'Only the PM can configure this report.',
        })
      if (data.visibleToMembers !== undefined) updates.visibleToMembers = data.visibleToMembers
      if (data.approverUserId !== undefined) updates.approverUserId = data.approverUserId ?? null
    }

    // Status transitions.
    let notifyApprover: string | null = null
    if (data.status !== undefined && data.status !== report.status) {
      const next = data.status
      if (next === 'in_review') {
        if (report.status !== 'draft')
          throw createError({ statusCode: 409, statusMessage: 'Only a draft can be submitted.' })
        if (report.kind === 'activity' ? !isAuthor : !(isAuthor || isLead))
          throw createError({ statusCode: 403, statusMessage: 'You cannot submit this report.' })
        updates.status = 'in_review'
        if (report.kind === 'general' && report.approverUserId)
          notifyApprover = report.approverUserId
      } else if (next === 'approved') {
        if (report.kind !== 'general')
          throw createError({
            statusCode: 400,
            statusMessage: 'Only the general report is approved.',
          })
        if (report.status !== 'in_review')
          throw createError({
            statusCode: 409,
            statusMessage: 'Only a report in review can be approved.',
          })
        if (!(isApprover || isLead))
          throw createError({
            statusCode: 403,
            statusMessage: 'Only the assigned approver can approve.',
          })
        updates.status = 'approved'
        updates.approvedByUserId = ctx.userId
        updates.approvedAt = new Date()
      } else if (next === 'draft') {
        if (!(isAuthor || isLead))
          throw createError({ statusCode: 403, statusMessage: 'You cannot recall this report.' })
        updates.status = 'draft'
        updates.approvedByUserId = null
        updates.approvedAt = null
      }
    }

    const [updated] = await db
      .update(projectReports)
      .set(updates)
      .where(eq(projectReports.id, rid))
      .returning()

    if (notifyApprover && notifyApprover !== ctx.userId) {
      await createNotifications([
        {
          organizationId: ctx.organizationId,
          userId: notifyApprover,
          type: 'project_report_review',
          title: `Report awaiting your approval — ${report.title}`,
          body: 'A project report has been sent to you for approval.',
          linkUrl: `/projects/${id}/reports/${rid}`,
        },
      ])
    }

    return { success: true, report: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating report', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
