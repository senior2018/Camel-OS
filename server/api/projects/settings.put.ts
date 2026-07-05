import { consola } from 'consola'

import { organizationProjectSettings } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateProjectSettingsSchema } from '@@/shared/schemas/project-settings'

/** Upsert the org's project settings. Admin or project leader (project:admin). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['project', 'admin'],
      ['admin', 'admin'],
    ])
    const payload = updateProjectSettingsSchema.parse(await readBody(event))

    // De-duplicate each list (case-insensitive) so pickers stay clean.
    const dedupe = (xs: string[]) => {
      const seen = new Set<string>()
      return xs.filter((x) => {
        const k = x.trim().toLowerCase()
        if (!x.trim() || seen.has(k)) return false
        seen.add(k)
        return true
      })
    }

    const row = {
      organizationId: ctx.organizationId,
      reportSections: dedupe(payload.reportSections),
      closeChecklist: dedupe(payload.closeChecklist),
      budgetCategories: dedupe(payload.budgetCategories),
      teamRoles: dedupe(payload.teamRoles),
      requireBudgetRevisionApproval: payload.requireBudgetRevisionApproval,
      updatedAt: new Date(),
    }
    if (!row.reportSections.length || !row.closeChecklist.length) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Report sections and the close checklist each need at least one entry.',
      })
    }

    await useDrizzle()
      .insert(organizationProjectSettings)
      .values(row)
      .onConflictDoUpdate({ target: organizationProjectSettings.organizationId, set: row })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'organization',
      action: 'project_settings_updated',
      resourceId: ctx.organizationId,
      meta: { sections: row.reportSections.length, roles: row.teamRoles.length },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving project settings', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
