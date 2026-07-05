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
  // S14 (PJ-01) — delivery ownership + inherited context.
  scope: z.string().trim().max(4000).optional().nullable(),
  clientId: z.string().uuid().optional().nullable(),
  projectManagerUserId: z.string().uuid().optional().nullable(),
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

// ─── Full Project Management module (S14–S15) ────────────────────────────────
export type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

export const PROJECT_STATUS_COLOR: Record<ProjectStatus, BadgeColor> = {
  planning: 'neutral',
  active: 'info',
  on_hold: 'warning',
  completed: 'success',
  cancelled: 'error',
}

export const MILESTONE_STATUSES = ['not_started', 'in_progress', 'completed'] as const
export type MilestoneStatus = (typeof MILESTONE_STATUSES)[number]
export const MILESTONE_STATUS_LABEL: Record<MilestoneStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  completed: 'Completed',
}
export const MILESTONE_STATUS_COLOR: Record<MilestoneStatus, BadgeColor> = {
  not_started: 'neutral',
  in_progress: 'info',
  completed: 'success',
}

export const ACTIVITY_STATUSES = ['todo', 'in_progress', 'blocked', 'done'] as const
export type ActivityStatus = (typeof ACTIVITY_STATUSES)[number]
export const ACTIVITY_STATUS_LABEL: Record<ActivityStatus, string> = {
  todo: 'To do',
  in_progress: 'In progress',
  blocked: 'Blocked',
  done: 'Done',
}
export const ACTIVITY_STATUS_COLOR: Record<ActivityStatus, BadgeColor> = {
  todo: 'neutral',
  in_progress: 'info',
  blocked: 'error',
  done: 'success',
}

export const PROJECT_REPORT_STATUSES = ['draft', 'in_review', 'approved'] as const
export type ProjectReportStatus = (typeof PROJECT_REPORT_STATUSES)[number]
export const PROJECT_REPORT_STATUS_LABEL: Record<ProjectReportStatus, string> = {
  draft: 'Draft',
  in_review: 'In review',
  approved: 'Approved',
}
export const PROJECT_REPORT_STATUS_COLOR: Record<ProjectReportStatus, BadgeColor> = {
  draft: 'neutral',
  in_review: 'info',
  approved: 'success',
}

// PJ-02
export const projectMemberSchema = z.object({
  userId: z.string().uuid(),
  role: z.string().trim().min(1).max(80).default('Team Member'),
  allocationPct: z.number().int().min(0).max(100).default(100),
})
export type ProjectMemberPayload = z.infer<typeof projectMemberSchema>

// PJ-03
export const milestoneSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dueDate: z.string().trim().min(1).nullish(),
  completionCriteria: z.string().trim().max(2000).nullish(),
  status: z.enum(MILESTONE_STATUSES).default('not_started'),
  orderIndex: z.number().int().min(0).default(0),
})
export type MilestonePayload = z.infer<typeof milestoneSchema>

// PJ-04
export const activitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  milestoneId: z.string().uuid().nullish(),
  assignedUserId: z.string().uuid().nullish(),
  startDate: z.string().trim().min(1).nullish(),
  endDate: z.string().trim().min(1).nullish(),
  plannedHours: z.number().min(0).nullish(),
  percentComplete: z.number().int().min(0).max(100).default(0),
  status: z.enum(ACTIVITY_STATUSES).default('todo'),
  dependsOnActivityId: z.string().uuid().nullish(),
})
export type ActivityPayload = z.infer<typeof activitySchema>

// PJ-05
export const projectBudgetSchema = z.object({
  lines: z
    .array(
      z.object({
        category: z.string().trim().min(1).max(120),
        phase: z.string().trim().max(120).nullish(),
        originalAmount: z.number().min(0).default(0),
        revisedAmount: z.number().min(0).nullish(),
      })
    )
    .max(200),
})
export type ProjectBudgetPayload = z.infer<typeof projectBudgetSchema>

// PJ-07
export const expenseSchema = z.object({
  budgetLineId: z.string().uuid().nullish(),
  amount: z.number().min(0),
  category: z.string().trim().max(120).nullish(),
  expenseDate: z.string().trim().min(1),
  description: z.string().trim().max(1000).nullish(),
  receiptUrl: z.string().trim().url().max(2000).nullish().or(z.literal('')),
})
export type ExpensePayload = z.infer<typeof expenseSchema>

// PJ-08
export const vendorSchema = z.object({
  name: z.string().trim().min(1).max(200),
  contactName: z.string().trim().max(160).nullish(),
  contactEmail: z.string().trim().email().max(160).nullish().or(z.literal('')),
  contractAmount: z.number().min(0).nullish(),
  currency: z.string().trim().length(3).default('USD'),
  scope: z.string().trim().max(2000).nullish(),
  paymentSchedule: z.string().trim().max(2000).nullish(),
  // Links the vendor's contract to a budget-line category so its spend rolls up.
  budgetCategory: z.string().trim().max(120).nullish(),
})
export type VendorPayload = z.infer<typeof vendorSchema>

// PJ-09 — report sections + template now live in shared/schemas/project-settings
// (org-configurable). See DEFAULT_PROJECT_REPORT_SECTIONS there.
export const projectReportSchema = z.object({
  title: z.string().trim().min(1).max(200),
  content: z.string().max(20000).nullish(),
})
export type ProjectReportPayload = z.infer<typeof projectReportSchema>

// PJ-06
export const timesheetEntrySchema = z.object({
  activityId: z.string().uuid().nullish(),
  entryDate: z.string().trim().min(1),
  hours: z.number().min(0).max(24),
  note: z.string().trim().max(500).nullish(),
})
export type TimesheetEntryPayload = z.infer<typeof timesheetEntrySchema>

// PJ-11 — close requires a completed sign-off checklist.
export const CLOSE_CHECKLIST_ITEMS = [
  'All milestones complete',
  'Final report approved',
  'Budget reconciled',
  'Client sign-off received',
  'Documents archived',
] as const
export const closeProjectSchema = z.object({
  checklist: z.record(z.string(), z.boolean()),
})
export type CloseProjectPayload = z.infer<typeof closeProjectSchema>
