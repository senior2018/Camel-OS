import { z } from 'zod'

// S7 — Reviewer / owner comments on an opportunity. `kind` distinguishes a
// reviewer opinion ("comment") from an owner status update ("update") so the
// timeline UI can render them differently.
export const OPPORTUNITY_COMMENT_KINDS = ['comment', 'update'] as const
export type OpportunityCommentKind = (typeof OPPORTUNITY_COMMENT_KINDS)[number]

export const OPPORTUNITY_COMMENT_KIND_LABEL: Record<OpportunityCommentKind, string> = {
  comment: 'Comment',
  update: 'Status update',
}

export const createOpportunityCommentSchema = z.object({
  kind: z.enum(OPPORTUNITY_COMMENT_KINDS).default('comment'),
  body: z.string().trim().min(1, 'Write something').max(5000),
  attachmentUrl: z
    .string()
    .trim()
    .url('Invalid URL')
    .max(500)
    .optional()
    .nullable()
    .or(z.literal('').transform(() => null)),
})

export type CreateOpportunityCommentPayload = z.output<typeof createOpportunityCommentSchema>
