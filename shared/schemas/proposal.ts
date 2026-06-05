import { z } from 'zod'

// S7 — Proposal module. Auto-created when an opportunity is Accepted; the
// proposal team takes it from Writing → Submitted → Won / Lost.

export const PROPOSAL_STATUSES = ['writing', 'submitted', 'won', 'lost'] as const
export type ProposalStatus = (typeof PROPOSAL_STATUSES)[number]

export const PROPOSAL_STATUS_LABEL: Record<ProposalStatus, string> = {
  writing: 'Writing',
  submitted: 'Submitted',
  won: 'Won',
  lost: 'Lost',
}

export const PROPOSAL_STATUS_DESCRIPTION: Record<ProposalStatus, string> = {
  writing: 'Team is drafting the response',
  submitted: 'Bid sent — awaiting decision',
  won: 'Awarded — work secured',
  lost: 'Not selected',
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
