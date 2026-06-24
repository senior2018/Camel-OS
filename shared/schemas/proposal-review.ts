import { z } from 'zod'

export const PROPOSAL_REVIEWER_STATUSES = [
  'pending',
  'approved',
  'changes_required',
  'rejected',
] as const
export type ProposalReviewerStatus = (typeof PROPOSAL_REVIEWER_STATUSES)[number]

export const PROPOSAL_REVIEWER_STATUS_LABEL: Record<ProposalReviewerStatus, string> = {
  pending: 'Pending Review',
  approved: 'Approved',
  changes_required: 'Changes Required',
  rejected: 'Rejected',
}

export type ReviewerStatusColor = 'neutral' | 'success' | 'warning' | 'error'

export const PROPOSAL_REVIEWER_STATUS_COLOR: Record<ProposalReviewerStatus, ReviewerStatusColor> = {
  pending: 'neutral',
  approved: 'success',
  changes_required: 'warning',
  rejected: 'error',
}

// A message is optional for Approve / Changes — but a Reject must carry a reason.
export const submitProposalReviewSchema = z
  .object({
    status: z.enum(['approved', 'changes_required', 'rejected']),
    feedback: z
      .string()
      .trim()
      .max(5000)
      .optional()
      .or(z.literal('').transform(() => undefined)),
  })
  .refine((v) => v.status !== 'rejected' || (v.feedback && v.feedback.length > 0), {
    message: 'A reason is required when rejecting',
    path: ['feedback'],
  })

export type SubmitProposalReviewPayload = z.infer<typeof submitProposalReviewSchema>
