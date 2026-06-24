import { eq } from 'drizzle-orm'

import { organizationProposalSettings } from '../database/schema'
import { useDrizzle } from './drizzle'
import {
  DEFAULT_OUTCOME_STAGES,
  DEFAULT_PROPOSAL_ROLES,
  type ProposalRoleDef,
} from '@@/shared/schemas/proposal-settings'

export interface ResolvedProposalSettings {
  roles: ProposalRoleDef[]
  outcomeStages: string[]
  reviewMinReviewers: number
  reviewRule: 'all' | 'count' | 'percent'
  reviewThreshold: number | null
  requireFinalApprover: boolean
}

/**
 * The organization's effective proposal settings: the stored row if present,
 * otherwise the shipped defaults. This is the system-wide layer that every
 * proposal inherits.
 */
export async function resolveOrgProposalSettings(
  organizationId: string
): Promise<ResolvedProposalSettings> {
  const [row] = await useDrizzle()
    .select()
    .from(organizationProposalSettings)
    .where(eq(organizationProposalSettings.organizationId, organizationId))
    .limit(1)

  if (!row) {
    return {
      roles: DEFAULT_PROPOSAL_ROLES,
      outcomeStages: DEFAULT_OUTCOME_STAGES,
      reviewMinReviewers: 3,
      reviewRule: 'all',
      reviewThreshold: null,
      requireFinalApprover: true,
    }
  }
  return {
    roles: (row.roles as ProposalRoleDef[]) ?? DEFAULT_PROPOSAL_ROLES,
    outcomeStages: (row.outcomeStages as string[]) ?? DEFAULT_OUTCOME_STAGES,
    reviewMinReviewers: row.reviewMinReviewers,
    reviewRule: row.reviewRule,
    reviewThreshold: row.reviewThreshold,
    requireFinalApprover: row.requireFinalApprover,
  }
}

/**
 * The effective settings for a single proposal: per-proposal overrides layered
 * over the org defaults. The proposal's own review-policy columns always win
 * (they are edited directly on the proposal); the role catalogue and outcome
 * stages fall back to the org defaults when not overridden.
 */
export async function resolveProposalSettings(proposal: {
  organizationId: string
  rolesOverride?: unknown
  outcomeStagesOverride?: unknown
  reviewMinReviewers: number
  reviewRule: 'all' | 'count' | 'percent'
  reviewThreshold: number | null
  requireFinalApprover: boolean
}): Promise<ResolvedProposalSettings> {
  const org = await resolveOrgProposalSettings(proposal.organizationId)
  const rolesOverride = proposal.rolesOverride as ProposalRoleDef[] | null | undefined
  const stagesOverride = proposal.outcomeStagesOverride as string[] | null | undefined
  return {
    roles: rolesOverride?.length ? rolesOverride : org.roles,
    outcomeStages: stagesOverride?.length ? stagesOverride : org.outcomeStages,
    reviewMinReviewers: proposal.reviewMinReviewers,
    reviewRule: proposal.reviewRule,
    reviewThreshold: proposal.reviewThreshold,
    requireFinalApprover: proposal.requireFinalApprover,
  }
}
