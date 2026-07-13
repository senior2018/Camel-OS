import { consola } from 'consola'

import { organizationCommunicationsSettings } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateCommunicationsSettingsSchema } from '@@/shared/schemas/communication-settings'

/** C2 — upsert platforms + per-platform metrics (communications lead or admin). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['communications', 'approve'],
      ['admin', 'admin'],
    ])
    const payload = updateCommunicationsSettingsSchema.parse(await readBody(event))

    const dedupe = (xs: string[]) => {
      const seen = new Set<string>()
      return xs.filter((x) => {
        const k = x.trim().toLowerCase()
        if (!x.trim() || seen.has(k)) return false
        seen.add(k)
        return true
      })
    }
    const platforms = dedupe(payload.platforms)
    // Keep only metrics for platforms that still exist; de-dupe metric labels.
    const platformMetrics: Record<string, string[]> = {}
    for (const p of platforms) platformMetrics[p] = dedupe(payload.platformMetrics[p] ?? [])

    const row = {
      organizationId: ctx.organizationId,
      platforms,
      platformMetrics,
      updatedAt: new Date(),
    }
    await useDrizzle()
      .insert(organizationCommunicationsSettings)
      .values(row)
      .onConflictDoUpdate({ target: organizationCommunicationsSettings.organizationId, set: row })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'organization',
      action: 'communications_settings_updated',
      resourceId: ctx.organizationId,
      meta: { platforms: platforms.length },
    })
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving communications settings', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
