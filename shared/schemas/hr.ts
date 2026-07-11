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

// ── HR-02 — recruitment ──────────────────────────────────────────────────────
export const VACANCY_STATUSES = ['open', 'on_hold', 'closed', 'filled'] as const
export type VacancyStatus = (typeof VACANCY_STATUSES)[number]
export const VACANCY_STATUS_LABEL: Record<VacancyStatus, string> = {
  open: 'Open',
  on_hold: 'On hold',
  closed: 'Closed',
  filled: 'Filled',
}
export const VACANCY_STATUS_COLOR: Record<VacancyStatus, BadgeColor> = {
  open: 'success',
  on_hold: 'warning',
  closed: 'neutral',
  filled: 'info',
}

export const APPLICANT_STAGES = [
  'applied',
  'screening',
  'interview',
  'offer',
  'hired',
  'rejected',
] as const
export type ApplicantStage = (typeof APPLICANT_STAGES)[number]
export const APPLICANT_STAGE_LABEL: Record<ApplicantStage, string> = {
  applied: 'Applied',
  screening: 'Screening',
  interview: 'Interview',
  offer: 'Offer',
  hired: 'Hired',
  rejected: 'Rejected',
}
export const APPLICANT_STAGE_COLOR: Record<ApplicantStage, BadgeColor> = {
  applied: 'neutral',
  screening: 'info',
  interview: 'primary',
  offer: 'warning',
  hired: 'success',
  rejected: 'error',
}

export const vacancySchema = z.object({
  title: shortText.min(1, 'Title is required'),
  department: optShortText,
  description: optLongText,
  employmentType: z.enum(EMPLOYMENT_TYPES).default('full_time'),
  location: optShortText,
  openings: z.coerce.number().int().min(1).max(999).default(1),
  status: z.enum(VACANCY_STATUSES).default('open'),
  closingDate: optDate,
})
export const vacancyUpdateSchema = vacancySchema.partial()

export const applicantSchema = z.object({
  name: shortText.min(1, 'Name is required'),
  email: z
    .union([z.string().email(), z.literal('')])
    .optional()
    .nullable(),
  phone: optShortText,
  cvUrl: z
    .union([z.string().url(), z.literal('')])
    .optional()
    .nullable(),
  stage: z.enum(APPLICANT_STAGES).default('applied'),
  rating: z.coerce.number().int().min(1).max(5).nullish(),
  notes: optLongText,
})
export const applicantUpdateSchema = applicantSchema.partial()

// ── HR-05 — performance reviews (360°) ───────────────────────────────────────
export const REVIEW_STATUSES = ['draft', 'collecting', 'completed'] as const
export type ReviewStatus = (typeof REVIEW_STATUSES)[number]
export const REVIEW_STATUS_LABEL: Record<ReviewStatus, string> = {
  draft: 'Draft',
  collecting: 'Collecting feedback',
  completed: 'Completed',
}
export const REVIEW_STATUS_COLOR: Record<ReviewStatus, BadgeColor> = {
  draft: 'neutral',
  collecting: 'warning',
  completed: 'success',
}

export const FEEDBACK_RELATIONSHIPS = ['self', 'manager', 'peer', 'report'] as const
export type FeedbackRelationship = (typeof FEEDBACK_RELATIONSHIPS)[number]
export const FEEDBACK_RELATIONSHIP_LABEL: Record<FeedbackRelationship, string> = {
  self: 'Self',
  manager: 'Manager',
  peer: 'Peer',
  report: 'Direct report',
}

export const reviewSchema = z.object({
  subjectUserId: z.string().uuid(),
  periodLabel: optShortText,
})
export const reviewUpdateSchema = z.object({
  periodLabel: optShortText,
  status: z.enum(REVIEW_STATUSES).optional(),
  overallRating: z.coerce.number().int().min(1).max(5).nullish(),
  summary: optLongText,
})
export const feedbackSchema = z.object({
  reviewerUserId: z.string().uuid(),
  relationship: z.enum(FEEDBACK_RELATIONSHIPS).default('peer'),
  rating: z.coerce.number().int().min(1).max(5).nullish(),
  strengths: optLongText,
  improvements: optLongText,
  comments: optLongText,
})

export type EmployeeProfileInput = z.infer<typeof employeeProfileSchema>
export type ExpertProfileInput = z.infer<typeof expertProfileSchema>
