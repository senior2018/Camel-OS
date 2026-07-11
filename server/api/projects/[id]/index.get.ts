import { consola } from 'consola'
import { and, asc, desc, eq } from 'drizzle-orm'

import {
  clients,
  projectActivities,
  projectBudgetLines,
  projectExpenses,
  projectMembers,
  projectMilestones,
  projectReports,
  projectVendors,
  projects,
  timesheetEntries,
  users,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { canOverseeProjects } from '@@/server/utils/project-settings'

/** Full project workspace payload (PJ-01..11) + a computed health summary. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'read')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const db = useDrizzle()

    const [project] = await db
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        description: projects.description,
        scope: projects.scope,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
        totalBudget: projects.totalBudget,
        currency: projects.currency,
        clientId: projects.clientId,
        clientName: clients.name,
        proposalId: projects.proposalId,
        projectManagerUserId: projects.projectManagerUserId,
        createdByUserId: projects.createdByUserId,
        pmFirstName: users.firstName,
        pmLastName: users.lastName,
        budgetRevisionStatus: projects.budgetRevisionStatus,
        budgetRevisionNote: projects.budgetRevisionNote,
        portalToken: projects.portalToken,
        closedAt: projects.closedAt,
        closeChecklist: projects.closeChecklist,
        createdAt: projects.createdAt,
      })
      .from(projects)
      .leftJoin(clients, eq(clients.id, projects.clientId))
      .leftJoin(users, eq(users.id, projects.projectManagerUserId))
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    // Need-to-know: only the PM, creator, a team member, or an oversight role
    // (system admin / project:admin) may open a project.
    const canViewAll = await canOverseeProjects(ctx.userId, ctx.isSystemAdmin)
    if (!canViewAll) {
      const isOwnerOrPm =
        project.projectManagerUserId === ctx.userId || project.createdByUserId === ctx.userId
      const [mine] = isOwnerOrPm
        ? [true]
        : await db
            .select({ one: projectMembers.id })
            .from(projectMembers)
            .where(and(eq(projectMembers.projectId, id), eq(projectMembers.userId, ctx.userId)))
            .limit(1)
      if (!mine) {
        throw createError({
          statusCode: 403,
          statusMessage: 'You do not have access to this project.',
        })
      }
    }

    const memberUser = users
    const members = await db
      .select({
        id: projectMembers.id,
        userId: projectMembers.userId,
        role: projectMembers.role,
        allocationPct: projectMembers.allocationPct,
        firstName: memberUser.firstName,
        lastName: memberUser.lastName,
        email: memberUser.email,
      })
      .from(projectMembers)
      .leftJoin(memberUser, eq(memberUser.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, id))
      .orderBy(asc(projectMembers.createdAt))

    const milestones = await db
      .select()
      .from(projectMilestones)
      .where(eq(projectMilestones.projectId, id))
      .orderBy(asc(projectMilestones.orderIndex), asc(projectMilestones.dueDate))

    const activities = await db
      .select({
        id: projectActivities.id,
        milestoneId: projectActivities.milestoneId,
        name: projectActivities.name,
        assignedUserId: projectActivities.assignedUserId,
        assigneeFirstName: users.firstName,
        assigneeLastName: users.lastName,
        startDate: projectActivities.startDate,
        endDate: projectActivities.endDate,
        plannedHours: projectActivities.plannedHours,
        percentComplete: projectActivities.percentComplete,
        status: projectActivities.status,
        dependsOnActivityId: projectActivities.dependsOnActivityId,
      })
      .from(projectActivities)
      .leftJoin(users, eq(users.id, projectActivities.assignedUserId))
      .where(eq(projectActivities.projectId, id))
      .orderBy(asc(projectActivities.startDate))

    const budgetLines = await db
      .select()
      .from(projectBudgetLines)
      .where(eq(projectBudgetLines.projectId, id))
      .orderBy(asc(projectBudgetLines.createdAt))

    const expenses = await db
      .select()
      .from(projectExpenses)
      .where(eq(projectExpenses.projectId, id))
      .orderBy(desc(projectExpenses.expenseDate))

    const vendors = await db
      .select()
      .from(projectVendors)
      .where(eq(projectVendors.projectId, id))
      .orderBy(asc(projectVendors.createdAt))

    const reports = await db
      .select({
        id: projectReports.id,
        title: projectReports.title,
        status: projectReports.status,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        updatedAt: projectReports.updatedAt,
      })
      .from(projectReports)
      .leftJoin(users, eq(users.id, projectReports.authorUserId))
      .where(eq(projectReports.projectId, id))
      .orderBy(desc(projectReports.updatedAt))

    const timesheet = await db
      .select({
        userId: timesheetEntries.userId,
        firstName: users.firstName,
        lastName: users.lastName,
        hours: timesheetEntries.hours,
        entryDate: timesheetEntries.entryDate,
      })
      .from(timesheetEntries)
      .leftJoin(users, eq(users.id, timesheetEntries.userId))
      .where(eq(timesheetEntries.projectId, id))

    // ── Health summary (PJ-10) ──
    const budgetPlanned = budgetLines.reduce(
      (s, l) => s + Number(l.revisedAmount ?? l.originalAmount),
      0
    )
    const totalBudget = budgetPlanned || Number(project.totalBudget ?? 0)
    const spent = expenses.reduce((s, e) => s + Number(e.amount), 0)
    const burnRate = totalBudget ? Math.round((spent / totalBudget) * 100) : 0
    const milestonesDone = milestones.filter((m) => m.status === 'completed').length
    const today = new Date().toISOString().slice(0, 10)
    const overdueMilestones = milestones.filter(
      (m) => m.status !== 'completed' && m.dueDate && m.dueDate < today
    ).length
    const tsByUser = new Map<string, { name: string; hours: number }>()
    for (const t of timesheet) {
      const cur = tsByUser.get(t.userId) ?? {
        name: [t.firstName, t.lastName].filter(Boolean).join(' ') || 'User',
        hours: 0,
      }
      cur.hours += Number(t.hours)
      tsByUser.set(t.userId, cur)
    }
    const loggedHours = [...tsByUser.values()].reduce((s, u) => s + u.hours, 0)

    // ── Weekly timesheet breakdown (PJ-06): hours per staff per ISO week. ──
    const weekStart = (dateStr: string) => {
      const d = new Date(`${dateStr}T00:00:00Z`)
      const mondayOffset = (d.getUTCDay() + 6) % 7 // Mon=0 … Sun=6
      d.setUTCDate(d.getUTCDate() - mondayOffset)
      return d.toISOString().slice(0, 10)
    }
    const weekSet = new Set<string>()
    const weeklyByUser = new Map<string, { name: string; byWeek: Record<string, number> }>()
    for (const t of timesheet) {
      if (!t.entryDate) continue
      const wk = weekStart(t.entryDate)
      weekSet.add(wk)
      const name = [t.firstName, t.lastName].filter(Boolean).join(' ') || 'User'
      const row = weeklyByUser.get(t.userId) ?? { name, byWeek: {} }
      row.byWeek[wk] = (row.byWeek[wk] ?? 0) + Number(t.hours)
      weeklyByUser.set(t.userId, row)
    }
    const weeks = [...weekSet].sort()
    const timesheetWeekly = {
      weeks,
      rows: [...weeklyByUser.entries()].map(([userId, r]) => ({
        userId,
        name: r.name,
        byWeek: r.byWeek,
        total: weeks.reduce((s, w) => s + (r.byWeek[w] ?? 0), 0),
      })),
    }

    return {
      project,
      members,
      milestones,
      activities,
      budgetLines,
      expenses,
      vendors,
      reports,
      timesheetByUser: [...tsByUser.entries()].map(([userId, v]) => ({ userId, ...v })),
      timesheetWeekly,
      summary: {
        budgetTotal: totalBudget,
        spent,
        burnRate,
        milestonesTotal: milestones.length,
        milestonesDone,
        overdueMilestones,
        activitiesTotal: activities.length,
        activitiesDone: activities.filter((a) => a.status === 'done').length,
        loggedHours,
        memberCount: members.length,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading project', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
