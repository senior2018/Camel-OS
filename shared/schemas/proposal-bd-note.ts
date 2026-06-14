import { z } from 'zod'

// S13 (BD-02) — post-submission tracking log entries.
export const BD_NOTE_KINDS = ['client_comm', 'evaluator_feedback', 'note'] as const
export type BdNoteKind = (typeof BD_NOTE_KINDS)[number]

export const BD_NOTE_KIND_LABEL: Record<BdNoteKind, string> = {
  client_comm: 'Client communication',
  evaluator_feedback: 'Evaluator feedback',
  note: 'Note',
}

export const createBdNoteSchema = z.object({
  kind: z.enum(BD_NOTE_KINDS).default('note'),
  body: z.string().trim().min(1, 'Note is required').max(5000),
})
export type CreateBdNotePayload = z.infer<typeof createBdNoteSchema>
