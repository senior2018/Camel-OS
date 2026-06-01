import { z } from 'zod'

// CR-10 — Minimal projects schema used by the donor-project linking feature in
// S6. The proper Project Management module (S13+) will replace this with a much
// richer schema; the field shape here is forward-compatible.

export const PROJECT_STATUSES = ['planning', 'active', 'on_hold', 'completed', 'cancelled'] as const
export type ProjectStatus = (typeof PROJECT_STATUSES)[number]

export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  on_hold: 'On hold',
  completed: 'Completed',
  cancelled: 'Cancelled',
}

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v && v.length > 0 ? v : null))

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

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(200),
  code: optionalText(50),
  description: optionalText(2000),
  status: z.enum(PROJECT_STATUSES).default('planning'),
  startDate: dateString,
  endDate: dateString,
  totalBudget: monetary,
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
})

export type CreateProjectPayload = z.output<typeof createProjectSchema>

export const updateProjectSchema = createProjectSchema.partial()
export type UpdateProjectPayload = z.output<typeof updateProjectSchema>

// CR-10 — Donor ↔ project link payload. `projectId` identifies the project to
// link; `fundingAmount` + `currency` capture the donor's contribution to that
// specific project.
export const linkDonorProjectSchema = z.object({
  projectId: z.string().uuid(),
  fundingAmount: monetary,
  currency: z.string().trim().length(3).toUpperCase().default('USD'),
  notes: optionalText(1000),
})

export type LinkDonorProjectPayload = z.output<typeof linkDonorProjectSchema>

export const updateDonorProjectSchema = z.object({
  fundingAmount: monetary,
  currency: z.string().trim().length(3).toUpperCase().optional(),
  notes: optionalText(1000),
})

export type UpdateDonorProjectPayload = z.output<typeof updateDonorProjectSchema>
