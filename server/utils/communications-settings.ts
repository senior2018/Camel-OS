import { eq } from 'drizzle-orm'

import { organizationCommunicationsSettings } from '../database/schema'
import { useDrizzle } from './drizzle'
import {
  DEFAULT_COMMUNICATIONS_SETTINGS,
  type CommunicationsSettings,
} from '@@/shared/schemas/communication-settings'

/** The org's effective communications settings (platforms + per-platform metrics). */
export async function resolveOrgCommunicationsSettings(
  organizationId: string
): Promise<CommunicationsSettings> {
  const [row] = await useDrizzle()
    .select()
    .from(organizationCommunicationsSettings)
    .where(eq(organizationCommunicationsSettings.organizationId, organizationId))
    .limit(1)
  if (!row) return structuredClone(DEFAULT_COMMUNICATIONS_SETTINGS)
  return {
    platforms: row.platforms?.length ? row.platforms : DEFAULT_COMMUNICATIONS_SETTINGS.platforms,
    platformMetrics: row.platformMetrics ?? DEFAULT_COMMUNICATIONS_SETTINGS.platformMetrics,
  }
}
