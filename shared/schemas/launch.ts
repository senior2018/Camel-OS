import { z } from 'zod'

type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'

export const UAT_STATUSES = ['untested', 'pass', 'fail', 'blocked'] as const
export type UatStatus = (typeof UAT_STATUSES)[number]
export const UAT_STATUS_COLOR: Record<UatStatus, BadgeColor> = {
  untested: 'neutral',
  pass: 'success',
  fail: 'error',
  blocked: 'warning',
}

export const FEEDBACK_CATEGORIES = ['bug', 'idea', 'question', 'praise'] as const
export type FeedbackCategory = (typeof FEEDBACK_CATEGORIES)[number]
export const FEEDBACK_CATEGORY_ICON: Record<FeedbackCategory, string> = {
  bug: 'i-lucide-bug',
  idea: 'i-lucide-lightbulb',
  question: 'i-lucide-help-circle',
  praise: 'i-lucide-heart',
}
export const FEEDBACK_STATUSES = ['new', 'triaged', 'resolved', 'wont_fix'] as const
export type FeedbackStatus = (typeof FEEDBACK_STATUSES)[number]
export const FEEDBACK_STATUS_COLOR: Record<FeedbackStatus, BadgeColor> = {
  new: 'info',
  triaged: 'warning',
  resolved: 'success',
  wont_fix: 'neutral',
}

export const createFeedbackSchema = z.object({
  category: z.enum(FEEDBACK_CATEGORIES),
  message: z.string().trim().min(3).max(2000),
  pageUrl: z.string().trim().max(300).nullish(),
})

// Seeded when a workspace first opens the cockpit — the module-by-module UAT
// scaffold and the go-live checklist, so testers/admins start with structure.
export const DEFAULT_UAT_MODULES = [
  'Opportunities',
  'Proposals',
  'CRM',
  'Projects',
  'MEL',
  'Communications',
  'HR & Expert DB',
  'Timesheets',
  'Strategy',
  'Finance',
  'Procurement',
  'Knowledge & Help',
  'Notifications & API',
  'Admin & Security',
]
export const DEFAULT_LAUNCH_TASKS: { category: string; label: string }[] = [
  { category: 'Data', label: 'Production database provisioned & migrated' },
  { category: 'Data', label: 'Seed / import of real organisational data' },
  { category: 'Security', label: 'Penetration test findings remediated' },
  { category: 'Security', label: 'MFA enforced for admins; secrets rotated' },
  { category: 'Security', label: 'Backups & restore tested' },
  { category: 'Quality', label: 'UAT sign-off across all modules' },
  { category: 'Quality', label: 'Accessibility audit passed (WCAG AA)' },
  { category: 'Quality', label: 'Performance budget met on key pages' },
  { category: 'Ops', label: 'Monitoring & error tracking live' },
  { category: 'Ops', label: 'Scheduled jobs / cron verified in prod' },
  { category: 'People', label: 'Staff training delivered' },
  { category: 'People', label: 'Knowledge base populated' },
  { category: 'People', label: 'Go-live support rota agreed' },
]
