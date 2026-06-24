import { z } from 'zod'

// S11/S12 — Proposal module (PM-01..PM-09). A proposal is auto-created when an
// opportunity is Accepted, then moves through a guided workflow:
//
//   assigned → drafting → awaiting_review → ready_for_final_approval →
//   awaiting_final_approval → final_approved → submitted → won / lost / shortlisted
//
// with two loop-backs: revision_required (a reviewer asked for changes) and
// rejected / final_rejected (a reviewer or the final approver stopped it).

export const PROPOSAL_STATUSES = [
  'assigned',
  'drafting',
  'awaiting_review',
  'revision_required',
  'rejected',
  'ready_for_final_approval',
  'awaiting_final_approval',
  'final_approved',
  'final_rejected',
  'submitted',
  'won',
  'lost',
  'shortlisted',
  'under_evaluation',
  'clarification_requested',
  'contract_signed',
] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  assigned: 'Assigned',
  drafting: 'Drafting',
  awaiting_review: 'Under Review',
  revision_required: 'Revision Required',
  rejected: 'Rejected',
  ready_for_final_approval: 'Ready for Final Approval',
  awaiting_final_approval: 'Awaiting Final Approval',
  final_approved: 'Approved to Submit',
  final_rejected: 'Final Rejected',
  submitted: 'Submitted',
  won: 'Won',
  lost: 'Lost',
  shortlisted: 'Shortlisted',
  under_evaluation: 'Under Evaluation',
  clarification_requested: 'Clarification Requested',
  contract_signed: 'Contract Signed',
}

export const PROPOSAL_STATUS_DESCRIPTION: Record<ProposalStatus, string> = {
  assigned: 'Proposal created — assign the team to begin',
  drafting: 'Team is drafting the response',
  awaiting_review: 'With reviewers for their decision',
  revision_required: 'A reviewer asked for changes',
  rejected: 'Stopped by a reviewer',
  ready_for_final_approval: 'All reviewers approved — awaiting final sign-off',
  awaiting_final_approval: 'With the final approver',
  final_approved: 'Cleared — ready to submit to the client',
  final_rejected: 'Stopped at final approval',
  submitted: 'Bid sent — awaiting decision',
  won: 'Awarded — work secured',
  lost: 'Not selected',
  shortlisted: 'Still under consideration',
  under_evaluation: 'Client is evaluating the bid',
  clarification_requested: 'Client requested clarification',
  contract_signed: 'Awarded and contracted — project created',
}

export type ProposalStatusColor = 'neutral' | 'primary' | 'info' | 'success' | 'warning' | 'error'

export const PROPOSAL_STATUS_COLOR: Record<ProposalStatus, ProposalStatusColor> = {
  assigned: 'neutral',
  drafting: 'primary',
  awaiting_review: 'info',
  revision_required: 'warning',
  rejected: 'error',
  ready_for_final_approval: 'info',
  awaiting_final_approval: 'info',
  final_approved: 'success',
  final_rejected: 'error',
  submitted: 'info',
  won: 'success',
  lost: 'error',
  shortlisted: 'warning',
  under_evaluation: 'info',
  clarification_requested: 'warning',
  contract_signed: 'success',
}

// Board lanes — the 13 statuses are too many for a Kanban; we group them into
// six readable lanes for the /proposals board.
export interface ProposalBoardLane {
  key: string
  label: string
  description: string
  statuses: ProposalStatus[]
}

export const PROPOSAL_BOARD_LANES: ProposalBoardLane[] = [
  {
    key: 'in_progress',
    label: 'In Progress',
    description: 'Assigned, drafting, or revising',
    statuses: ['assigned', 'drafting', 'revision_required'],
  },
  {
    key: 'in_review',
    label: 'Under Review',
    description: 'With reviewers',
    statuses: ['awaiting_review'],
  },
  {
    key: 'approval',
    label: 'Approval',
    description: 'Final sign-off',
    statuses: ['ready_for_final_approval', 'awaiting_final_approval'],
  },
  {
    key: 'ready',
    label: 'Submitted / Evaluation',
    description: 'Cleared, sent, or under client evaluation',
    statuses: ['final_approved', 'submitted', 'under_evaluation', 'clarification_requested'],
  },
  {
    key: 'outcome',
    label: 'Outcome',
    description: 'Won, lost, shortlisted, or contracted',
    statuses: ['won', 'lost', 'shortlisted', 'contract_signed'],
  },
  {
    key: 'closed',
    label: 'Withdrawn',
    description: 'Stopped before submission — not pursued',
    statuses: ['rejected', 'final_rejected'],
  },
]

export function laneForStatus(status: ProposalStatus): ProposalBoardLane {
  return (
    PROPOSAL_BOARD_LANES.find((lane) => lane.statuses.includes(status)) ?? PROPOSAL_BOARD_LANES[0]!
  )
}

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

// S11 (PM-03) — how the proposal is authored.
export const PROPOSAL_WRITING_MODES = ['in_system', 'upload', 'both'] as const
export type ProposalWritingMode = (typeof PROPOSAL_WRITING_MODES)[number]
export const PROPOSAL_WRITING_MODE_LABEL: Record<ProposalWritingMode, string> = {
  in_system: 'Write in-system',
  upload: 'Upload documents',
  both: 'Both',
}

export const updateProposalSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(PROPOSAL_STATUSES).optional(),
  deadline: optionalDate,
  contentDraft: z.string().trim().max(50_000).optional().nullable(),
  decisionNote: z.string().trim().max(2000).optional().nullable(),
  // S12 (PM-04) — brainstorming board.
  brainstorm: z.string().trim().max(20_000).optional().nullable(),
  // S11 (PM-03/PM-09)
  writingMode: z.enum(PROPOSAL_WRITING_MODES).optional(),
  submissionReference: z.string().trim().max(200).optional().nullable(),
  submissionChannel: z.string().trim().max(100).optional().nullable(),
  // P3.3b — evaluation-stage label (free text) + an optional note that posts
  // to the conversation and, for won/lost, is kept as the decision note.
  evaluationStage: z.string().trim().max(120).optional().nullable(),
  note: z.string().trim().max(2000).optional().nullable(),
  // Reminder fan-out — recipients to notify before the proposal deadline. We
  // keep this open (anyone in the org) since the team decides who needs to
  // know; final notification logic is wired in a later sprint.
  reminderRecipientUserIds: z.array(z.string().uuid()).max(50).optional(),
})

export type UpdateProposalPayload = z.output<typeof updateProposalSchema>

// P3.3 — configurable review policy.
export const PROPOSAL_REVIEW_RULES = ['all', 'count', 'percent'] as const
export type ProposalReviewRule = (typeof PROPOSAL_REVIEW_RULES)[number]
export const PROPOSAL_REVIEW_RULE_LABEL: Record<ProposalReviewRule, string> = {
  all: 'All reviewers must approve',
  count: 'At least N reviewers approve',
  percent: 'At least a percentage approve',
}

export const updateReviewPolicySchema = z
  .object({
    reviewMinReviewers: z.number().int().min(1).max(20),
    reviewRule: z.enum(PROPOSAL_REVIEW_RULES),
    reviewThreshold: z.number().int().min(1).max(100).nullable().optional(),
    requireFinalApprover: z.boolean(),
  })
  .refine((v) => v.reviewRule === 'all' || (v.reviewThreshold ?? 0) >= 1, {
    message: 'A threshold is required for count/percent rules',
    path: ['reviewThreshold'],
  })
  .refine((v) => v.reviewRule !== 'percent' || (v.reviewThreshold ?? 0) <= 100, {
    message: 'Percentage cannot exceed 100',
    path: ['reviewThreshold'],
  })

export type UpdateReviewPolicyPayload = z.output<typeof updateReviewPolicySchema>
