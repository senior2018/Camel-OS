import { z } from 'zod'

export const PROPOSAL_ASSIGNMENT_ROLES = [
  'lead',
  'technical_reviewer',
  'finance_reviewer',
  'compliance_reviewer',
  'final_approver',
] as const

export type ProposalAssignmentRole = (typeof PROPOSAL_ASSIGNMENT_ROLES)[number]

export const PROPOSAL_ASSIGNMENT_ROLE_LABEL: Record<ProposalAssignmentRole, string> = {
  lead: 'Proposal Lead',
  technical_reviewer: 'Technical Reviewer',
  finance_reviewer: 'Finance Reviewer',
  compliance_reviewer: 'Compliance Reviewer',
  final_approver: 'Final Approver',
}

export const PROPOSAL_ASSIGNMENT_ROLE_DESCRIPTION: Record<ProposalAssignmentRole, string> = {
  lead: 'Writes and manages the proposal',
  technical_reviewer: 'Reviews technical content and approach',
  finance_reviewer: 'Reviews budget and pricing',
  compliance_reviewer: 'Reviews compliance and legal aspects',
  final_approver: 'Final approval before submission',
}

export const createProposalAssignmentSchema = z.object({
  roleType: z.enum(PROPOSAL_ASSIGNMENT_ROLES),
  assignedUserId: z.string().uuid('Must be a valid user ID'),
})

export type CreateProposalAssignmentPayload = z.infer<typeof createProposalAssignmentSchema>

export const createMultipleAssignmentsSchema = z.object({
  assignments: z.array(createProposalAssignmentSchema).min(1, 'At least one assignment required'),
})

export type CreateMultipleAssignmentsPayload = z.infer<typeof createMultipleAssignmentsSchema>

// Batch reconcile: the full desired set of role → user assignments. Roles not
// present are treated as unassigned. An empty array clears the whole team.
export const saveProposalAssignmentsSchema = z.object({
  assignments: z.array(createProposalAssignmentSchema).max(PROPOSAL_ASSIGNMENT_ROLES.length),
})

export type SaveProposalAssignmentsPayload = z.infer<typeof saveProposalAssignmentsSchema>
