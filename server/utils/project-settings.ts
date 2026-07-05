import { eq } from 'drizzle-orm'

import { organizationProjectSettings } from '../database/schema'
import { useDrizzle } from './drizzle'
import { userHasPermission } from './role'
import { DEFAULT_PROJECT_SETTINGS, type ProjectSettings } from '@@/shared/schemas/project-settings'

/**
 * Whether the caller can see every project (bypassing need-to-know): a system
 * admin, a project leader (`project:admin`), or finance staff (`finance:read`)
 * who oversee project spend org-wide.
 */
export async function canOverseeProjects(userId: string, isSystemAdmin: boolean): Promise<boolean> {
  if (isSystemAdmin) return true
  return (
    (await userHasPermission(userId, 'project', 'admin')) ||
    (await userHasPermission(userId, 'finance', 'read'))
  )
}

/**
 * Who may manage a project's team/ownership: its PM, its creator, a project
 * leader (`project:admin`), or a system admin. Deliberately NOT everyone with
 * `project:update` — a consultant shouldn't be able to re-staff a project.
 */
export async function canManageProjectTeam(
  userId: string,
  isSystemAdmin: boolean,
  project: { projectManagerUserId: string | null; createdByUserId: string | null }
): Promise<boolean> {
  if (isSystemAdmin) return true
  if (project.projectManagerUserId === userId || project.createdByUserId === userId) return true
  return userHasPermission(userId, 'project', 'admin')
}

/**
 * The organization's effective project settings: the stored row if present,
 * otherwise the shipped defaults. Read by the report/close/budget/team flows so
 * they honour whatever the admin or project leader configured.
 */
export async function resolveOrgProjectSettings(organizationId: string): Promise<ProjectSettings> {
  const [row] = await useDrizzle()
    .select()
    .from(organizationProjectSettings)
    .where(eq(organizationProjectSettings.organizationId, organizationId))
    .limit(1)

  if (!row) return { ...DEFAULT_PROJECT_SETTINGS }
  return {
    reportSections: row.reportSections?.length
      ? row.reportSections
      : DEFAULT_PROJECT_SETTINGS.reportSections,
    closeChecklist: row.closeChecklist?.length
      ? row.closeChecklist
      : DEFAULT_PROJECT_SETTINGS.closeChecklist,
    budgetCategories: row.budgetCategories ?? DEFAULT_PROJECT_SETTINGS.budgetCategories,
    teamRoles: row.teamRoles ?? DEFAULT_PROJECT_SETTINGS.teamRoles,
    requireBudgetRevisionApproval: row.requireBudgetRevisionApproval,
  }
}
