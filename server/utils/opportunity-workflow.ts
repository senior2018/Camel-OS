import { and, eq } from 'drizzle-orm'

import { opportunityStageActivities } from '../database/schema'
import { useDrizzle } from './drizzle'
import type { OpportunityStage } from '@@/shared/schemas/opportunity'

/**
 * Per-stage activity checklists. Seeded when an opportunity enters a stage
 * for the first time so every team member sees the same to-do list. Custom
 * items can be added per opportunity; these are the defaults.
 *
 * The labels here are the firm's default workflow. If a client wants to
 * customise them, we'd move this into an admin-editable table later.
 */
export const STAGE_DEFAULT_ACTIVITIES: Record<OpportunityStage, readonly string[]> = {
  discovery: [
    'Read the call / RFP / brief end-to-end',
    'Confirm eligibility (geography, sector, partner requirements)',
    'Run a first-pass go/no-go with the lead',
  ],
  qualifying: [
    'Deep-dive eligibility + capacity check',
    'Identify proposal lead + reviewers',
    'Decide consortium vs solo bid',
    'Confirm budget realism vs effort to bid',
  ],
  proposal: [
    'Technical narrative drafted',
    'Methodology drafted',
    'Team CVs assembled',
    'Budget + workplan finalised',
    'Internal review complete',
    'Final sign-off from partner',
  ],
  submitted: [
    'Submission confirmed by client (receipt / acknowledgement)',
    'Internal debrief logged',
    'Awaiting result',
  ],
  won: [
    'Contract / award letter received',
    'Project handover to delivery team',
    'Update finance + invoicing',
  ],
  lost: [
    'Feedback requested from client (if applicable)',
    'Internal post-mortem captured',
    'Lessons learned shared with team',
  ],
} as const

/**
 * Seed default activities for `(opportunityId, stage)` if none exist yet.
 * Idempotent — call freely whenever the opp enters a stage; if seeded already
 * this is a no-op.
 */
export async function seedActivitiesIfMissing(
  opportunityId: string,
  organizationId: string,
  stage: OpportunityStage
): Promise<void> {
  const db = useDrizzle()
  const existing = await db
    .select({ id: opportunityStageActivities.id })
    .from(opportunityStageActivities)
    .where(
      and(
        eq(opportunityStageActivities.opportunityId, opportunityId),
        eq(opportunityStageActivities.stage, stage)
      )
    )
    .limit(1)
  if (existing.length > 0) return

  const labels = STAGE_DEFAULT_ACTIVITIES[stage]
  if (labels.length === 0) return

  await db.insert(opportunityStageActivities).values(
    labels.map((label, idx) => ({
      opportunityId,
      organizationId,
      stage,
      label,
      sortOrder: idx,
    }))
  )
}
