import { z } from 'zod'

export const CLIENT_TYPES = ['client', 'prospect', 'donor', 'partner'] as const
export type ClientType = (typeof CLIENT_TYPES)[number]

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  client: 'Client',
  prospect: 'Prospect',
  donor: 'Donor',
  partner: 'Partner',
}

// Partnership flavours — surface as a dropdown when type === 'partner' (CR-08).
// Free-form notes live in `metadata.scope`; structured agreement records belong
// in the upcoming `partnership_agreements` table (CR-11).
export const PARTNERSHIP_TYPES = [
  'implementation',
  'sub_grantee',
  'consortium',
  'mou',
  'other',
] as const
export type PartnershipType = (typeof PARTNERSHIP_TYPES)[number]

export const PARTNERSHIP_TYPE_LABEL: Record<PartnershipType, string> = {
  implementation: 'Implementation partner',
  sub_grantee: 'Sub-grantee',
  consortium: 'Consortium member',
  mou: 'MOU',
  other: 'Other',
}

/**
 * Type-specific extras for `clients.metadata`. Each variant is opt-in — only the
 * relevant fields are sent based on `type`. Unknown keys are ignored on read so
 * admins can drop in extra fields without breaking older clients.
 */
export const clientMetadataSchema = z
  .object({
    // Donor fields
    focusAreas: z.array(z.string().trim().min(1).max(60)).max(20).optional(),
    reportingLanguage: z.string().trim().max(20).optional(),
    fiscalYearStart: z
      .string()
      .trim()
      .regex(/^\d{2}-\d{2}$/, 'Use MM-DD')
      .optional(),
    // Partner fields
    partnershipType: z.enum(PARTNERSHIP_TYPES).optional(),
    scope: z.string().trim().max(2000).optional(),
  })
  .partial()
  .nullable()

export type ClientMetadata = z.output<typeof clientMetadataSchema>

export const CLIENT_INTERACTION_TYPES = ['meeting', 'call', 'email', 'note', 'other'] as const
export type ClientInteractionType = (typeof CLIENT_INTERACTION_TYPES)[number]

export const CLIENT_INTERACTION_TYPE_LABEL: Record<ClientInteractionType, string> = {
  meeting: 'Meeting',
  call: 'Call',
  email: 'Email',
  note: 'Note',
  other: 'Other',
}

// ─── Shared building blocks ───────────────────────────────────────────────────

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .email('Invalid email')
  .max(200)
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .url('Invalid URL')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

const optionalDate = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

// ─── Client ───────────────────────────────────────────────────────────────────

/** Body for `POST /api/clients` (CR-01 + CR-08). */
export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: z.enum(CLIENT_TYPES).default('prospect'),
  industry: optionalText(100),
  country: optionalText(100),
  website: optionalUrl,
  phone: optionalText(50),
  email: optionalEmail,
  notes: optionalText(2000),
  metadata: clientMetadataSchema.optional(),
  ownerUserId: z.string().uuid().optional().nullable(),
})

export type CreateClientPayload = z.output<typeof createClientSchema>

/** Body for `PATCH /api/clients/:id`. Every field optional. */
export const updateClientSchema = createClientSchema.partial()

export type UpdateClientPayload = z.output<typeof updateClientSchema>

// ─── Client contact ───────────────────────────────────────────────────────────

/** Body for `POST /api/clients/:id/contacts`. */
export const createContactSchema = z.object({
  firstName: z.string().trim().min(1, 'First name is required').max(100),
  lastName: optionalText(100),
  title: optionalText(150),
  email: optionalEmail,
  phone: optionalText(50),
  isPrimary: z.boolean().optional().default(false),
})

export type CreateContactPayload = z.output<typeof createContactSchema>

export const updateContactSchema = createContactSchema.partial()
export type UpdateContactPayload = z.output<typeof updateContactSchema>

// ─── Client interaction (CR-02) ───────────────────────────────────────────────

/**
 * Body for `POST /api/clients/:id/interactions`. `occurredAt` accepts either a
 * date-only string (YYYY-MM-DD) or a full ISO timestamp — both are stored as a
 * UTC timestamp in the column. Defaulting to "now" keeps the quick-log flow
 * one-click for the common case.
 */
export const createInteractionSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  type: z.enum(CLIENT_INTERACTION_TYPES).default('note'),
  occurredAt: z
    .string()
    .trim()
    .min(1, 'When did this happen?')
    .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date'),
  summary: z.string().trim().min(1, 'Summary is required').max(5000),
  followUpAt: optionalDate,
  followUpAction: optionalText(500),
})

export type CreateInteractionPayload = z.output<typeof createInteractionSchema>

export const updateInteractionSchema = createInteractionSchema.partial()
export type UpdateInteractionPayload = z.output<typeof updateInteractionSchema>

// ─── Opportunity ↔ client link (CR-03) ────────────────────────────────────────

/** Body for `POST /api/clients/:id/opportunities`. */
export const linkOpportunitySchema = z.object({
  opportunityId: z.string().uuid(),
  isPrimary: z.boolean().optional().default(false),
})

export type LinkOpportunityPayload = z.output<typeof linkOpportunitySchema>

// ─── Client reminder (CR-05) ──────────────────────────────────────────────────

/**
 * Body for `POST /api/clients/:id/reminders`. `dueAt` accepts any string that
 * `Date.parse` understands — typically an ISO-8601 timestamp from the
 * `datetime-local` input. We don't enforce a regex because the browser format
 * (`YYYY-MM-DDTHH:mm`) doesn't carry a timezone and we want to keep flexibility
 * to accept full ISO strings from API clients too.
 */
const datetimeString = z
  .string()
  .trim()
  .min(1, 'Due date is required')
  .refine((v) => !Number.isNaN(Date.parse(v)), 'Invalid date/time')

export const createReminderSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  assignedUserId: z.string().uuid(),
  dueAt: datetimeString,
  message: z.string().trim().min(1, 'Message is required').max(500),
})

export type CreateReminderPayload = z.output<typeof createReminderSchema>

export const updateReminderSchema = z.object({
  contactId: z.string().uuid().optional().nullable(),
  assignedUserId: z.string().uuid().optional(),
  dueAt: datetimeString.optional(),
  message: z.string().trim().min(1).max(500).optional(),
  completed: z.boolean().optional(),
})

export type UpdateReminderPayload = z.output<typeof updateReminderSchema>

// ─── Donor grants (CR-09) ─────────────────────────────────────────────────────

export const DONOR_GRANT_STATUSES = ['pending', 'active', 'completed', 'cancelled'] as const
export type DonorGrantStatus = (typeof DONOR_GRANT_STATUSES)[number]

export const DONOR_GRANT_STATUS_LABEL: Record<DonorGrantStatus, string> = {
  pending: 'Pending',
  active: 'Active',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const monetary = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v.trim()))
  .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Invalid amount'))
  .optional()
  .nullable()

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

export const createGrantSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  startDate: dateString,
  endDate: dateString,
  totalValue: monetary,
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  reportingSchedule: optionalText(500),
  nextReportingDate: dateString,
  status: z.enum(DONOR_GRANT_STATUSES).default('pending'),
  notes: optionalText(2000),
})

export type CreateGrantPayload = z.output<typeof createGrantSchema>

export const updateGrantSchema = createGrantSchema.partial()
export type UpdateGrantPayload = z.output<typeof updateGrantSchema>
