import { consola } from 'consola'

import { organizationProposalSettings } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { updateProposalSettingsSchema } from '@@/shared/schemas/proposal-settings'

/** Upsert the organization's system-wide proposal settings (admin only). */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const payload = updateProposalSettingsSchema.parse(await readBody(event))

    // Guardrails: unique role keys + at least one Lead behaviour.
    const keys = new Set<string>()
    for (const r of payload.roles) {
      if (keys.has(r.key)) {
        throw createError({ statusCode: 400, statusMessage: `Duplicate role key: ${r.key}` })
      }
      keys.add(r.key)
    }
    if (!payload.roles.some((r) => r.behavior === 'lead')) {
      throw createError({ statusCode: 400, statusMessage: 'Keep at least one Lead role.' })
    }

    const row = {
      organizationId: admin.organizationId,
      roles: payload.roles,
      outcomeStages: payload.outcomeStages,
      reviewMinReviewers: payload.reviewMinReviewers,
      reviewRule: payload.reviewRule,
      reviewThreshold: payload.reviewRule === 'all' ? null : (payload.reviewThreshold ?? null),
      requireFinalApprover: payload.requireFinalApprover,
      updatedAt: new Date(),
    }

    await useDrizzle()
      .insert(organizationProposalSettings)
      .values(row)
      .onConflictDoUpdate({ target: organizationProposalSettings.organizationId, set: row })

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'organization',
      action: 'proposal_settings_updated',
      resourceId: admin.organizationId,
      meta: { roles: payload.roles.length, stages: payload.outcomeStages.length },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving proposal settings', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
