import { z } from 'zod'

export const OPPORTUNITY_STAGES = [
  'discovery',
  'qualifying',
  'proposal',
  'submitted',
  'won',
  'lost',
] as const

export const OPPORTUNITY_SOURCES = [
  'tender',
  'grant',
  'partnership',
  'referral',
  'inbound',
  'other',
] as const

export const OPPORTUNITY_TYPES = [
  'consulting',
  'training',
  'research',
  'advisory',
  'other',
] as const

export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]
export type OpportunitySource = (typeof OPPORTUNITY_SOURCES)[number]
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number]

/**
 * Stable display labels for the Kanban columns and source/type pickers.
 * Kept beside the enums so the UI never duplicates them.
 */
export const OPPORTUNITY_STAGE_LABEL: Record<OpportunityStage, string> = {
  discovery: 'Discovery',
  qualifying: 'Qualifying',
  proposal: 'Proposal',
  submitted: 'Submitted',
  won: 'Won',
  lost: 'Lost',
}

export const OPPORTUNITY_SOURCE_LABEL: Record<OpportunitySource, string> = {
  tender: 'Tender',
  grant: 'Grant',
  partnership: 'Partnership',
  referral: 'Referral',
  inbound: 'Inbound',
  other: 'Other',
}

export const OPPORTUNITY_TYPE_LABEL: Record<OpportunityType, string> = {
  consulting: 'Consulting',
  training: 'Training',
  research: 'Research',
  advisory: 'Advisory',
  other: 'Other',
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

const monetary = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v.trim()))
  .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Invalid amount'))
  .optional()
  .nullable()

const optionalDate = z
  .string()
  .trim()
  .min(1)
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional()
  .nullable()

/**
 * Body for `POST /api/opportunities` and the manual-entry form (OM-02).
 * Required fields mirror the user-story acceptance criteria:
 * "title, source, deadline, value, type".
 */
export const createOpportunitySchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().trim().max(5000).optional().nullable(),
  source: z.enum(OPPORTUNITY_SOURCES).default('other'),
  type: z.enum(OPPORTUNITY_TYPES).default('consulting'),
  deadline: optionalDate,
  estimatedValue: monetary,
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  winProbability: z.number().int().min(0).max(100).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).optional().default([]),
  ownerUserId: z.string().uuid().optional().nullable(),
})

export type CreateOpportunityPayload = z.output<typeof createOpportunitySchema>

/**
 * Body for `PATCH /api/opportunities/:id`. Every field optional so the form
 * can submit partial edits.
 */
export const updateOpportunitySchema = createOpportunitySchema.partial()

export type UpdateOpportunityPayload = z.output<typeof updateOpportunitySchema>

/** Body for `POST /api/opportunities/:id/stage` (OM-09 stage transition). */
export const updateOpportunityStageSchema = z.object({
  stage: z.enum(OPPORTUNITY_STAGES),
  note: z.string().trim().max(1000).optional(),
})

export type UpdateOpportunityStagePayload = z.output<typeof updateOpportunityStageSchema>
