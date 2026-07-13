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
  // PJ-01 (P4) — link the project to the proposal it originated from.
  proposalId: z.string().uuid().optional().nullable(),
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

// PJ-03 — milestone status is DERIVED from activities (P14), never set here.
export const milestoneSchema = z.object({
  name: z.string().trim().min(1).max(200),
  dueDate: z.string().trim().min(1).nullish(),
  completionCriteria: z.string().trim().max(2000).nullish(),
  orderIndex: z.number().int().min(0).default(0),
})
export type MilestonePayload = z.infer<typeof milestoneSchema>

// PJ-04 — create. Status is NOT set here: a new activity starts at the first
// "not started" configured status. Its creator is auto-assigned server-side
// when no assignee is given (P21).
export const createActivitySchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).nullish(),
  milestoneId: z.string().uuid().nullish(),
  assignedUserId: z.string().uuid().nullish(),
  startDate: z.string().trim().min(1).nullish(),
  endDate: z.string().trim().min(1).nullish(),
  plannedHours: z.number().min(0).nullish(),
  dependsOnActivityId: z.string().uuid().nullish(),
})
export type CreateActivityPayload = z.infer<typeof createActivitySchema>

// PJ-04 — update. `statusLabel` must be one of the org's configured activity
// statuses (validated server-side); changing it is gated to the assignee or PM.
export const updateActivitySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(4000).nullish(),
  milestoneId: z.string().uuid().nullish(),
  assignedUserId: z.string().uuid().nullish(),
  startDate: z.string().trim().min(1).nullish(),
  endDate: z.string().trim().min(1).nullish(),
  plannedHours: z.number().min(0).nullish(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  statusLabel: z.string().trim().min(1).max(80).optional(),
  dependsOnActivityId: z.string().uuid().nullish(),
})
export type UpdateActivityPayload = z.infer<typeof updateActivitySchema>

// P16 — a comment/progress note on an activity.
export const activityCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})
export type ActivityCommentPayload = z.infer<typeof activityCommentSchema>

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

// P9 — expense request → approval → return.
export const expenseRequestSchema = z.object({
  purpose: z.string().trim().min(1).max(500),
  category: z.string().trim().max(120).nullish(),
  amount: z.number().min(0),
})
export type ExpenseRequestPayload = z.infer<typeof expenseRequestSchema>

export const expenseApproveSchema = z.object({
  approve: z.boolean(),
  note: z.string().trim().max(1000).nullish(),
})
export type ExpenseApprovePayload = z.infer<typeof expenseApproveSchema>

export const expenseReturnSchema = z.object({
  spentAmount: z.number().min(0),
  receiptUrl: z.string().trim().url().max(2000).nullish().or(z.literal('')),
  returnNote: z.string().trim().max(1000).nullish(),
})
export type ExpenseReturnPayload = z.infer<typeof expenseReturnSchema>

export const EXPENSE_REQUEST_STATUS_LABEL: Record<string, string> = {
  requested: 'Requested',
  approved: 'Approved',
  rejected: 'Rejected',
  returned: 'Returned',
}
export const EXPENSE_REQUEST_STATUS_COLOR: Record<string, BadgeColor> = {
  requested: 'warning',
  approved: 'info',
  rejected: 'error',
  returned: 'success',
}

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

// PJ-09 / P17 — reports are free-form (no enforced sections). Two kinds:
// 'activity' (a member's report on their activities, submit-only) and 'general'
// (the project report, reviewed + approved).
export const REPORT_KINDS = ['activity', 'general'] as const
export type ReportKind = (typeof REPORT_KINDS)[number]

export const createProjectReportSchema = z.object({
  title: z.string().trim().min(1).max(200),
  kind: z.enum(REPORT_KINDS).default('general'),
  activityIds: z.array(z.string().uuid()).max(100).default([]),
  content: z.string().max(200000).nullish(),
})
export type CreateProjectReportPayload = z.infer<typeof createProjectReportSchema>

export const updateProjectReportSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  content: z.string().max(200000).nullish(),
  activityIds: z.array(z.string().uuid()).max(100).optional(),
  visibleToMembers: z.boolean().optional(),
  approverUserId: z.string().uuid().nullish(),
  // Status transitions are validated server-side against kind + role.
  status: z.enum(PROJECT_REPORT_STATUSES).optional(),
})
export type UpdateProjectReportPayload = z.infer<typeof updateProjectReportSchema>

// Status label depends on kind: an activity report is "Submitted", not "In review".
export function reportStatusLabel(status: ProjectReportStatus, kind: string): string {
  if (kind === 'activity' && status === 'in_review') return 'Submitted'
  return PROJECT_REPORT_STATUS_LABEL[status]
}

// PJ-06
export const timesheetEntrySchema = z.object({
  activityId: z.string().uuid().nullish(),
  entryDate: z.string().trim().min(1),
  hours: z.number().min(0).max(24),
  note: z.string().trim().max(500).nullish(),
})
export type TimesheetEntryPayload = z.infer<typeof timesheetEntrySchema>

// PJ-11 — close requires a completed sign-off checklist. The checklist items
// themselves are org-configurable (see DEFAULT_PROJECT_CLOSE_CHECKLIST in
// shared/schemas/project-settings and the Projects → Settings page) — nothing
// here is hard-coded.
export const closeProjectSchema = z.object({
  checklist: z.record(z.string(), z.boolean()),
  // P20 — closing always records why (kept for the audit trail + reopen context).
  reason: z.string().trim().min(3, 'Give a reason for closing').max(1000),
})
export type CloseProjectPayload = z.infer<typeof closeProjectSchema>
