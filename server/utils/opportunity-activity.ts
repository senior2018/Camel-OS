import { consola } from 'consola'

import { opportunityActivities } from '../database/schema'
import { useDrizzle } from './drizzle'

export interface OpportunityActivityInput {
  opportunityId: string
  organizationId: string
  userId?: string | null
  action: string
  details?: Record<string, unknown> | null
}

/**
 * Append an entry to an opportunity's activity timeline. Proposal-stage events
 * are logged here too (keyed by the proposal's opportunityId) so a single
 * timeline tells the whole discovery → submission story. Best-effort: a logging
 * failure must never break the main request.
 */
export async function logOpportunityActivity(input: OpportunityActivityInput): Promise<void> {
  try {
    const db = useDrizzle()
    await db.insert(opportunityActivities).values({
      opportunityId: input.opportunityId,
      organizationId: input.organizationId,
      userId: input.userId ?? null,
      action: input.action,
      details: input.details ?? null,
    })
  } catch (err) {
    consola.error('[OpportunityActivity]', (err as Error).message)
  }
}
