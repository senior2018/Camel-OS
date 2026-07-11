import { z } from 'zod'

/** Shared validation + vocabulary for Timesheets (TS-01…06, S18–S19). */

export type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

export const TIMESHEET_STATUSES = ['draft', 'submitted', 'approved', 'rejected'] as const
export type TimesheetStatus = (typeof TIMESHEET_STATUSES)[number]
export const TIMESHEET_STATUS_LABEL: Record<TimesheetStatus, string> = {
  draft: 'Draft',
  submitted: 'Submitted',
  approved: 'Approved',
  rejected: 'Returned',
}
export const TIMESHEET_STATUS_COLOR: Record<TimesheetStatus, BadgeColor> = {
  draft: 'neutral',
  submitted: 'warning',
  approved: 'success',
  rejected: 'error',
}

// TS-01 — a single daily log line.
export const timesheetEntrySchema = z
  .object({
    entryDate: reqDate,
    hours: z.coerce.number().min(0.25, 'At least 0.25h').max(24, 'Max 24h'),
    projectId: z.string().uuid().nullish(),
    activityId: z.string().uuid().nullish(),
    taskLabel: z.string().trim().max(255).optional().nullable(),
    note: z.string().trim().max(1000).optional().nullable(),
  })
  .refine((v) => !!v.projectId || !!v.taskLabel?.trim(), {
    message: 'Pick a project or name an internal task',
    path: ['projectId'],
  })

// TS-02 — submit a whole week.
export const submitWeekSchema = z.object({ weekStart: reqDate })

// TS-03 (S19) — manager decision on a week.
export const timesheetDecisionSchema = z.object({
  weekStart: reqDate,
  userId: z.string().uuid(),
  status: z.enum(['approved', 'rejected']),
  decisionNote: z.string().trim().max(2000).optional().nullable(),
})
