import { z } from 'zod'

/** Shared validation + vocabulary for HR & the Expert Database (S17–S19). */

export type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

// ── Field helpers ──────────────────────────────────────────────────────────
const shortText = z.string().trim().max(255)
const optShortText = shortText.optional().nullable()
const optLongText = z.string().trim().max(4000).optional().nullable()
/** Accepts 'YYYY-MM-DD', '' or null → normalises empties to null. */
const optDate = z.preprocess(
  (v) => (v === '' || v == null ? null : v),
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .nullable()
)
const reqDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')

// ── Vocabulary ───────────────────────────────────────────────────────────────
export const EMPLOYMENT_TYPES = [
  'full_time',
  'part_time',
  'contract',
  'consultant',
  'intern',
] as const
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number]
export const EMPLOYMENT_TYPE_LABEL: Record<EmploymentType, string> = {
  full_time: 'Full-time',
  part_time: 'Part-time',
  contract: 'Contract',
  consultant: 'Consultant',
  intern: 'Intern',
}

export const EMPLOYEE_STATUSES = ['active', 'on_leave', 'suspended', 'terminated'] as const
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number]
export const EMPLOYEE_STATUS_LABEL: Record<EmployeeStatus, string> = {
  active: 'Active',
  on_leave: 'On leave',
  suspended: 'Suspended',
  terminated: 'Terminated',
}
export const EMPLOYEE_STATUS_COLOR: Record<EmployeeStatus, BadgeColor> = {
  active: 'success',
  on_leave: 'info',
  suspended: 'warning',
  terminated: 'neutral',
}

export const LEAVE_TYPES = [
  'annual',
  'sick',
  'unpaid',
  'maternity',
  'paternity',
  'compassionate',
  'study',
] as const
export type LeaveType = (typeof LEAVE_TYPES)[number]
export const LEAVE_TYPE_LABEL: Record<LeaveType, string> = {
  annual: 'Annual',
  sick: 'Sick',
  unpaid: 'Unpaid',
  maternity: 'Maternity',
  paternity: 'Paternity',
  compassionate: 'Compassionate',
  study: 'Study',
}

export const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'] as const
export type LeaveStatus = (typeof LEAVE_STATUSES)[number]
export const LEAVE_STATUS_LABEL: Record<LeaveStatus, string> = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}
export const LEAVE_STATUS_COLOR: Record<LeaveStatus, BadgeColor> = {
  pending: 'warning',
  approved: 'success',
  rejected: 'error',
  cancelled: 'neutral',
}

export const EXPERT_AVAILABILITIES = ['available', 'partially_available', 'unavailable'] as const
export type ExpertAvailability = (typeof EXPERT_AVAILABILITIES)[number]
export const EXPERT_AVAILABILITY_LABEL: Record<ExpertAvailability, string> = {
  available: 'Available',
  partially_available: 'Partially available',
  unavailable: 'Unavailable',
}
export const EXPERT_AVAILABILITY_COLOR: Record<ExpertAvailability, BadgeColor> = {
  available: 'success',
  partially_available: 'warning',
  unavailable: 'neutral',
}

export const LANGUAGE_PROFICIENCIES = [
  'basic',
  'conversational',
  'professional',
  'fluent',
  'native',
] as const

// ── HR-01 — personnel file ───────────────────────────────────────────────────
export const employeeProfileSchema = z.object({
  userId: z.string().uuid(),
  employeeNumber: optShortText,
  jobTitle: optShortText,
  department: optShortText,
  employmentType: z.enum(EMPLOYMENT_TYPES).default('full_time'),
  status: z.enum(EMPLOYEE_STATUSES).default('active'),
  managerUserId: z.string().uuid().nullish(),
  startDate: optDate,
  endDate: optDate,
  dateOfBirth: optDate,
  nationalId: optShortText,
  phone: optShortText,
  address: optLongText,
  emergencyContactName: optShortText,
  emergencyContactPhone: optShortText,
  annualLeaveEntitlement: z.coerce.number().min(0).max(365).default(21),
  baseSalary: z.coerce.number().min(0).max(99999999).nullish(),
  currency: z.string().trim().length(3).default('USD'),
  notes: optLongText,
})
export const employeeProfileUpdateSchema = employeeProfileSchema.omit({ userId: true }).partial()

// ── HR-03 — leave request ────────────────────────────────────────────────────
export const leaveRequestSchema = z
  .object({
    type: z.enum(LEAVE_TYPES).default('annual'),
    startDate: reqDate,
    endDate: reqDate,
    reason: optLongText,
  })
  .refine((v) => v.endDate >= v.startDate, {
    message: 'End date must be on or after the start date',
    path: ['endDate'],
  })
export const leaveDecisionSchema = z.object({
  status: z.enum(['approved', 'rejected', 'cancelled']),
  decisionNote: optLongText,
})

// ── HR-07 — certification / training ─────────────────────────────────────────
export const certificationSchema = z.object({
  userId: z.string().uuid(),
  name: shortText.min(1, 'Name is required'),
  issuer: optShortText,
  kind: z.enum(['certification', 'training']).default('certification'),
  issuedDate: optDate,
  expiryDate: optDate,
  credentialId: optShortText,
  notes: optLongText,
})

// ── EX-01 / EX-02 — expert profile + virtual CV ──────────────────────────────
const cvEducation = z.object({
  institution: z.string().trim().min(1),
  qualification: z.string().trim().min(1),
  year: z.string().trim().max(10).optional(),
})
const cvExperience = z.object({
  role: z.string().trim().min(1),
  organization: z.string().trim().min(1),
  startYear: z.string().trim().max(10).optional(),
  endYear: z.string().trim().max(10).optional(),
  description: z.string().trim().max(1000).optional(),
})
const cvLanguage = z.object({
  language: z.string().trim().min(1),
  proficiency: z.string().trim().min(1),
})

export const expertProfileSchema = z.object({
  userId: z.string().uuid(),
  headline: optShortText,
  summary: optLongText,
  yearsExperience: z.coerce.number().int().min(0).max(80).nullish(),
  dailyRate: z.coerce.number().min(0).max(99999999).nullish(),
  currency: z.string().trim().length(3).default('USD'),
  availability: z.enum(EXPERT_AVAILABILITIES).default('available'),
  skills: z.array(z.string().trim().min(1)).default([]),
  languages: z.array(cvLanguage).default([]),
  sectors: z.array(z.string().trim().min(1)).default([]),
  countries: z.array(z.string().trim().min(1)).default([]),
  education: z.array(cvEducation).default([]),
  experience: z.array(cvExperience).default([]),
  linkedinUrl: z
    .union([z.string().url(), z.literal('')])
    .optional()
    .nullable(),
})
export const expertProfileUpdateSchema = expertProfileSchema.omit({ userId: true })

// ── EX-06 — Personal Growth Plan ─────────────────────────────────────────────
export const GOAL_STATUSES = ['not_started', 'in_progress', 'achieved'] as const
export type GoalStatus = (typeof GOAL_STATUSES)[number]
export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  achieved: 'Achieved',
}
export const GOAL_STATUS_COLOR: Record<GoalStatus, BadgeColor> = {
  not_started: 'neutral',
  in_progress: 'info',
  achieved: 'success',
}

export const growthPlanSchema = z.object({
  periodLabel: optShortText,
  reviewNotes: optLongText,
  goals: z
    .array(
      z.object({
        area: z.string().trim().min(1),
        objective: z.string().trim().min(1),
        actions: z.string().trim().max(1000).optional(),
        targetDate: z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}$/), z.literal('')]).optional(),
        status: z.enum(GOAL_STATUSES).default('not_started'),
      })
    )
    .default([]),
})

export type EmployeeProfileInput = z.infer<typeof employeeProfileSchema>
export type ExpertProfileInput = z.infer<typeof expertProfileSchema>
