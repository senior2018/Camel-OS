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
    label: 'Ready / Submitted',
    description: 'Cleared or sent to client',
    statuses: ['final_approved', 'submitted'],
  },
  {
    key: 'outcome',
    label: 'Outcome',
    description: 'Won, lost, or shortlisted',
    statuses: ['won', 'lost', 'shortlisted'],
  },
  {
    key: 'closed',
    label: 'Closed',
    description: 'Stopped before submission',
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

export const updateProposalSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  status: z.enum(PROPOSAL_STATUSES).optional(),
  deadline: optionalDate,
  contentDraft: z.string().trim().max(50_000).optional().nullable(),
  decisionNote: z.string().trim().max(2000).optional().nullable(),
  // Reminder fan-out — recipients to notify before the proposal deadline. We
  // keep this open (anyone in the org) since the team decides who needs to
  // know; final notification logic is wired in a later sprint.
  reminderRecipientUserIds: z.array(z.string().uuid()).max(50).optional(),
})

export type UpdateProposalPayload = z.output<typeof updateProposalSchema>
