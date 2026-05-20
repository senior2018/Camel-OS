import { z } from 'zod'

export const CLIENT_TYPES = ['client', 'prospect'] as const
export type ClientType = (typeof CLIENT_TYPES)[number]

export const CLIENT_TYPE_LABEL: Record<ClientType, string> = {
  client: 'Client',
  prospect: 'Prospect',
}

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

/** Body for `POST /api/clients` (CR-01). */
export const createClientSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  type: z.enum(CLIENT_TYPES).default('prospect'),
  industry: optionalText(100),
  country: optionalText(100),
  website: optionalUrl,
  phone: optionalText(50),
  email: optionalEmail,
  notes: optionalText(2000),
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
