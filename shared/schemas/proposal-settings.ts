import { z } from 'zod'

import { PROPOSAL_REVIEW_RULES } from './proposal'

/**
 * Configurable proposal settings (redesign v2, P3.4).
 *
 * The platform ships sensible defaults, but every list here is editable —
 * **system-wise** (an org default that all proposals inherit) and **proposal-
 * wise** (a per-proposal override). Nothing is hard-coded into the UI.
 *
 * `behavior` is the fixed engine concept that drives logic; a `role` is a named,
 * configurable label mapped onto a behavior (so "Technical Reviewer" and
 * "Finance Reviewer" are two roles that both behave as `reviewer`).
 */
export const PROPOSAL_BEHAVIORS = [
  'lead',
  'writer',
  'reviewer',
  'approver',
  'commenter',
  'viewer',
] as const
export type ProposalBehavior = (typeof PROPOSAL_BEHAVIORS)[number]

export const PROPOSAL_BEHAVIOR_LABEL: Record<ProposalBehavior, string> = {
  lead: 'Lead (owns the proposal)',
  writer: 'Writer (edits the document)',
  reviewer: 'Reviewer (approves / requests changes)',
  approver: 'Approver (final sign-off)',
  commenter: 'Commenter (conversation only)',
  viewer: 'Viewer (read-only)',
}

export interface ProposalRoleDef {
  key: string
  label: string
  behavior: ProposalBehavior
  /** At most one holder per proposal (lead, final approver). */
  singleInstance?: boolean
}

export const DEFAULT_PROPOSAL_ROLES: ProposalRoleDef[] = [
  { key: 'lead', label: 'Proposal Lead', behavior: 'lead', singleInstance: true },
  { key: 'author', label: 'Author', behavior: 'writer' },
  { key: 'technical_reviewer', label: 'Technical Reviewer', behavior: 'reviewer' },
  { key: 'finance_reviewer', label: 'Finance Reviewer', behavior: 'reviewer' },
  { key: 'compliance_reviewer', label: 'Compliance Reviewer', behavior: 'reviewer' },
  { key: 'final_approver', label: 'Final Approver', behavior: 'approver', singleInstance: true },
  { key: 'commenter', label: 'Commenter', behavior: 'commenter' },
  { key: 'viewer', label: 'Viewer', behavior: 'viewer' },
]

export const DEFAULT_OUTCOME_STAGES = [
  'Under evaluation',
  'Clarification requested',
  'Shortlisted',
  'Interview / Presentation',
  'Site visit',
  'BAFO (best and final offer)',
  'Negotiation',
]

/**
 * Map a behavior onto the stored `proposalAssignments.roleType` enum value, so
 * the existing review/writing logic keeps working. Reviewer *categories* are
 * distinguished by the role label, not separate enum values.
 */
export function roleTypeForBehavior(
  b: ProposalBehavior
): 'lead' | 'contributor' | 'reviewer' | 'final_approver' | 'commenter' | 'viewer' {
  switch (b) {
    case 'lead':
      return 'lead'
    case 'writer':
      return 'contributor'
    case 'reviewer':
      return 'reviewer'
    case 'approver':
      return 'final_approver'
    case 'commenter':
      return 'commenter'
    case 'viewer':
      return 'viewer'
  }
}

/** Inverse of `roleTypeForBehavior` — used to map stored assignments to roles. */
export function behaviorForRoleType(roleType: string): ProposalBehavior {
  switch (roleType) {
    case 'lead':
      return 'lead'
    case 'contributor':
      return 'writer'
    case 'final_approver':
      return 'approver'
    case 'commenter':
      return 'commenter'
    case 'viewer':
      return 'viewer'
    default:
      // reviewer + legacy technical/finance/compliance reviewers
      return 'reviewer'
  }
}

// ── Validation schemas ──────────────────────────────────────────────────────
export const proposalRoleDefSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers and underscores'),
  label: z.string().trim().min(1).max(60),
  behavior: z.enum(PROPOSAL_BEHAVIORS),
  singleInstance: z.boolean().optional(),
})

export const updateProposalSettingsSchema = z.object({
  roles: z.array(proposalRoleDefSchema).min(1).max(40),
  outcomeStages: z.array(z.string().trim().min(1).max(80)).max(40),
  reviewMinReviewers: z.number().int().min(1).max(20),
  reviewRule: z.enum(PROPOSAL_REVIEW_RULES),
  reviewThreshold: z.number().int().min(1).max(100).nullable().optional(),
  requireFinalApprover: z.boolean(),
})
export type UpdateProposalSettingsPayload = z.output<typeof updateProposalSettingsSchema>

// Per-proposal override (P3.4-S3). `null` for either field = inherit the org.
export const updateProposalOverrideSchema = z.object({
  roles: z.array(proposalRoleDefSchema).min(1).max(40).nullable(),
  outcomeStages: z.array(z.string().trim().min(1).max(80)).max(40).nullable(),
})
export type UpdateProposalOverridePayload = z.output<typeof updateProposalOverrideSchema>
