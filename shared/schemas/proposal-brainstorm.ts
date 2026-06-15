import { z } from 'zod'

// PM-04 — a single sticky note on the proposal brainstorming board.
export const createBrainstormNoteSchema = z.object({
  body: z.string().trim().min(1, 'Note is required').max(2000),
})

export type CreateBrainstormNotePayload = z.infer<typeof createBrainstormNoteSchema>
