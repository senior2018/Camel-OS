import { z } from 'zod'

export const LOOKUP_KINDS = ['opportunity_source', 'opportunity_type'] as const
export type LookupKind = (typeof LOOKUP_KINDS)[number]

export const LOOKUP_KIND_LABEL: Record<LookupKind, string> = {
  opportunity_source: 'Opportunity source',
  opportunity_type: 'Opportunity type',
}

/**
 * Body for creating / updating a lookup value. `key` is the stable machine
 * identifier stored on opportunity rows; we lower-snake-case it server-side to
 * keep the data predictable. `label` is the human-facing name admins edit.
 */
export const createLookupSchema = z.object({
  kind: z.enum(LOOKUP_KINDS),
  key: z
    .string()
    .trim()
    .min(1, 'Key is required')
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores'),
  label: z.string().trim().min(1, 'Label is required').max(100),
  sortOrder: z.number().int().optional(),
})

export type CreateLookupPayload = z.output<typeof createLookupSchema>

export const updateLookupSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
})

export type UpdateLookupPayload = z.output<typeof updateLookupSchema>
