import { z } from 'zod'

export const OPPORTUNITY_STAGES = [
  'discovery',
  'qualifying',
  'proposal',
  'submitted',
  'won',
  'lost',
] as const

// S5b — Source and Type are no longer enums; admins manage them as lookup
// values per organization. These string aliases stay for typing convenience.
export type OpportunityStage = (typeof OPPORTUNITY_STAGES)[number]
export type OpportunitySource = string
export type OpportunityType = string

// Seeded defaults still used by audit-log formatters and any UI that hasn't
// loaded the lookup values yet. The /opportunities/lookup-values endpoint is
// the live source of truth.
export const DEFAULT_OPPORTUNITY_SOURCE_LABELS: Record<string, string> = {
  tender: 'Tender',
  grant: 'Grant',
  partnership: 'Partnership',
  referral: 'Referral',
  inbound: 'Inbound',
  other: 'Other',
}

export const DEFAULT_OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  consulting: 'Consulting',
  training: 'Training',
  research: 'Research',
  advisory: 'Advisory',
  other: 'Other',
}

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

// Backward-compatibility: existing UI references these via direct lookup.
// Returns the seeded default label if known, else the raw key humanised.
function humanise(key: string): string {
  return key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, ' ')
}

export const OPPORTUNITY_SOURCE_LABEL = new Proxy(DEFAULT_OPPORTUNITY_SOURCE_LABELS, {
  get(target, prop: string) {
    return target[prop] ?? humanise(prop)
  },
}) as Record<string, string>

export const OPPORTUNITY_TYPE_LABEL = new Proxy(DEFAULT_OPPORTUNITY_TYPE_LABELS, {
  get(target, prop: string) {
    return target[prop] ?? humanise(prop)
  },
}) as Record<string, string>

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
  // Source + type are now admin-editable lookup keys. The endpoint validates
  // them against `crm_lookup_values` for the caller's org, so we don't enum
  // them here — Zod only enforces shape (lowercase snake key).
  source: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/)
    .default('other'),
  type: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9_]+$/)
    .default('consulting'),
  deadline: optionalDate,
  estimatedValue: monetary,
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  ownerUserId: z.string().uuid().optional().nullable(),
  // CR-03: primary client link. Optional — opportunities can exist without one.
  primaryClientId: z.string().uuid().optional().nullable(),
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
