import { z } from 'zod'

export const OPPORTUNITY_DECISION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type OpportunityDecisionStatus = (typeof OPPORTUNITY_DECISION_STATUSES)[number]

export const OPPORTUNITY_DECISION_STATUS_LABEL: Record<OpportunityDecisionStatus, string> = {
  pending: 'Pending Decision',
  approved: 'Approved for Proposal',
  rejected: 'Not Pursuing',
}

export const OPPORTUNITY_DECISION_STATUS_DESCRIPTION: Record<OpportunityDecisionStatus, string> = {
  pending: 'Awaiting go/no-go decision',
  approved: 'Approved to proceed with proposal',
  rejected: 'Decision made not to pursue',
}

export const createOpportunityDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected']),
  decisionReason: z.string().min(1, 'Reason is required'),
})

export type CreateOpportunityDecisionPayload = z.infer<typeof createOpportunityDecisionSchema>
