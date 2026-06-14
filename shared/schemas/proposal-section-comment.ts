import { z } from 'zod'

// S12 (PM-06) — reviewer feedback anchored to a section, with threaded replies.
export const createProposalCommentSchema = z.object({
  sectionId: z.string().uuid().optional().nullable(),
  parentCommentId: z.string().uuid().optional().nullable(),
  body: z.string().trim().min(1, 'Comment is required').max(5000),
})

export type CreateProposalCommentPayload = z.infer<typeof createProposalCommentSchema>
