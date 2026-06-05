import { z } from 'zod'

// S7 — Opportunity is now a 3-status review pipeline. The legacy 6-stage list
// stays in the codebase so audit-log entries and migrated stage rows can still
// be labelled, but the live UI only references `OPPORTUNITY_STATUSES`.
export const OPPORTUNITY_STATUSES = ['pending', 'accepted', 'rejected'] as const
export type OpportunityStatus = (typeof OPPORTUNITY_STATUSES)[number]

export const OPPORTUNITY_STATUS_LABEL: Record<OpportunityStatus, string> = {
  pending: 'Pending',
  accepted: 'Accepted',
  rejected: 'Rejected',
}

export const OPPORTUNITY_STATUS_DESCRIPTION: Record<OpportunityStatus, string> = {
  pending: 'Found, awaiting review',
  accepted: 'Approved to pursue — proposal in flight',
  rejected: 'Decision: not pursuing',
}

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
// Free-form description added on the create form.
const optionalDescription = z
  .string()
  .trim()
  .max(5000)
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

// 0–100 inclusive. Manual today; AI-driven later.
const winProbability = z.number().int().min(0, 'Min 0').max(100, 'Max 100').optional().nullable()

// Multi-select tag chips. Lowercase keys, no spaces, max 12.
const tagsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1)
      .max(40)
      .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lowercase letters, numbers, _ or -')
  )
  .max(12, 'Up to 12 tags')
  .optional()

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
  description: optionalDescription,
  tags: tagsSchema,
  winProbability,
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

/**
 * Body for `POST /api/opportunities/:id/status`. Comment is required when
 * moving to 'rejected' so the reason lives in the comments thread — the API
 * inserts the comment automatically.
 */
export const updateOpportunityStatusSchema = z
  .object({
    status: z.enum(OPPORTUNITY_STATUSES),
    comment: z.string().trim().max(2000).optional(),
  })
  .refine((v) => v.status !== 'rejected' || (v.comment && v.comment.trim().length > 0), {
    message: 'A reason is required when rejecting an opportunity.',
    path: ['comment'],
  })

export type UpdateOpportunityStatusPayload = z.output<typeof updateOpportunityStatusSchema>

/** Legacy stage endpoint (still used by stage activities + audit log). */
export const updateOpportunityStageSchema = z.object({
  stage: z.enum(OPPORTUNITY_STAGES),
  note: z.string().trim().max(1000).optional(),
})

export type UpdateOpportunityStagePayload = z.output<typeof updateOpportunityStageSchema>
