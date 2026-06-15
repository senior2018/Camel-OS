import { z } from 'zod'

// S11 (PM-02/PM-03) — structured, co-authored proposal sections.

export const createProposalSectionSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  body: z.string().trim().max(100_000).optional().nullable(),
  assignedToUserId: z.string().uuid().optional().nullable(),
})
export type CreateProposalSectionPayload = z.infer<typeof createProposalSectionSchema>

export const updateProposalSectionSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  body: z.string().trim().max(100_000).optional().nullable(),
  sortOrder: z.number().int().min(0).optional(),
  assignedToUserId: z.string().uuid().optional().nullable(),
  // PM-03 — the `updatedAt` the client loaded; if it no longer matches, another
  // writer saved in the meantime and we reject the write (409) to avoid clobber.
  expectedUpdatedAt: z.string().datetime().optional(),
})
export type UpdateProposalSectionPayload = z.infer<typeof updateProposalSectionSchema>

// Default template the Lead can one-click seed when writing in-system.
export const DEFAULT_PROPOSAL_SECTIONS = [
  'Executive Summary',
  'Understanding & Context',
  'Technical Approach & Methodology',
  'Work Plan & Timeline',
  'Team & Experience',
  'Budget Narrative',
] as const
