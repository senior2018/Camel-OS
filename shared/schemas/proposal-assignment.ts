import { z } from 'zod'

// S11 — two teams, assigned separately:
//   • Writing team  — Lead + contributors (the Lead manages contributors)
//   • Review team   — reviewers + final approver (the manager manages these)
// The legacy technical/finance/compliance values are treated as reviewers.
export const PROPOSAL_ASSIGNMENT_ROLES = [
  'lead',
  'contributor',
  'reviewer',
  'technical_reviewer',
  'finance_reviewer',
  'compliance_reviewer',
  'final_approver',
] as const

export type ProposalAssignmentRole = (typeof PROPOSAL_ASSIGNMENT_ROLES)[number]

export const PROPOSAL_ASSIGNMENT_ROLE_LABEL: Record<ProposalAssignmentRole, string> = {
  lead: 'Proposal Lead',
  contributor: 'Contributor',
  reviewer: 'Reviewer',
  technical_reviewer: 'Technical Reviewer',
  finance_reviewer: 'Finance Reviewer',
  compliance_reviewer: 'Compliance Reviewer',
  final_approver: 'Final Approver',
}

export const PROPOSAL_ASSIGNMENT_ROLE_DESCRIPTION: Record<ProposalAssignmentRole, string> = {
  lead: 'Writes and manages the proposal',
  contributor: 'Co-authors assigned proposal sections',
  reviewer: 'Reviews and approves before submission',
  technical_reviewer: 'Reviews technical content and approach',
  finance_reviewer: 'Reviews budget and pricing',
  compliance_reviewer: 'Reviews compliance and legal aspects',
  final_approver: 'Final approval before submission',
}

// Which roles belong to which team, and who manages each.
export const PROPOSAL_TEAM_GROUPS = ['writing', 'review'] as const
export type ProposalTeamGroup = (typeof PROPOSAL_TEAM_GROUPS)[number]

export const GROUP_ROLES: Record<ProposalTeamGroup, ProposalAssignmentRole[]> = {
  // Lead-managed writing team. (Lead itself is assigned by the manager in the
  // review group; the Lead then adds contributors here.)
  writing: ['contributor'],
  // Manager-managed: the Lead, the reviewer list, and the final approver.
  review: [
    'lead',
    'reviewer',
    'technical_reviewer',
    'finance_reviewer',
    'compliance_reviewer',
    'final_approver',
  ],
}

// Roles that may only have one holder per proposal.
export const SINGLE_INSTANCE_ROLES: ProposalAssignmentRole[] = ['lead', 'final_approver']

// Reviewer-category roles (count toward the PM-05 ≥3 gate).
export const REVIEWER_ROLES: ProposalAssignmentRole[] = [
  'reviewer',
  'technical_reviewer',
  'finance_reviewer',
  'compliance_reviewer',
]

export const createProposalAssignmentSchema = z.object({
  roleType: z.enum(PROPOSAL_ASSIGNMENT_ROLES),
  assignedUserId: z.string().uuid('Must be a valid user ID'),
})
export type CreateProposalAssignmentPayload = z.infer<typeof createProposalAssignmentSchema>

// Group-scoped reconcile: replace only the assignments belonging to `group`,
// leaving the other team untouched. Empty array clears that group.
export const saveProposalTeamSchema = z.object({
  group: z.enum(PROPOSAL_TEAM_GROUPS),
  assignments: z.array(createProposalAssignmentSchema).max(50),
})
export type SaveProposalTeamPayload = z.infer<typeof saveProposalTeamSchema>
