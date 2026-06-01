import { z } from 'zod'

// CR-11 — Partnership agreements tracked per partner client. The renewal cron
// fires email at 90 and 30 days before `endDate`. Status is a manual flag so
// the agreement card can show draft/active/expired/terminated without us having
// to derive it from dates every render.

export const PARTNERSHIP_AGREEMENT_STATUSES = ['draft', 'active', 'expired', 'terminated'] as const
export type PartnershipAgreementStatus = (typeof PARTNERSHIP_AGREEMENT_STATUSES)[number]

export const PARTNERSHIP_AGREEMENT_STATUS_LABEL: Record<PartnershipAgreementStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  expired: 'Expired',
  terminated: 'Terminated',
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))

const optionalUrl = z
  .string()
  .trim()
  .max(500)
  .url('Invalid URL')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

const dateString = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null))

const monetary = z
  .union([z.number(), z.string()])
  .transform((v) => (typeof v === 'number' ? v.toFixed(2) : v.trim()))
  .pipe(z.string().regex(/^\d{1,12}(\.\d{1,2})?$/, 'Invalid amount'))
  .optional()
  .nullable()

export const createAgreementSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  startDate: dateString,
  endDate: dateString,
  value: monetary,
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  status: z.enum(PARTNERSHIP_AGREEMENT_STATUSES).default('draft'),
  documentUrl: optionalUrl,
  notes: optionalText(2000),
})

export type CreateAgreementPayload = z.output<typeof createAgreementSchema>

export const updateAgreementSchema = createAgreementSchema.partial()
export type UpdateAgreementPayload = z.output<typeof updateAgreementSchema>
