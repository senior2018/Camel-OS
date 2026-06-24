import { z } from 'zod'

// Redesign v2 (P3) — a chat message in a proposal's conversation.
export const createProposalMessageSchema = z.object({
  body: z.string().trim().min(1, 'Message is required').max(5000),
})

export type CreateProposalMessagePayload = z.infer<typeof createProposalMessageSchema>
