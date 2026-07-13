import { z } from 'zod'

/**
 * Configurable project settings (S14/15). The platform ships sensible defaults,
 * but every vocabulary here is editable by an admin or a project leader — the
 * report template's sections, the close-out checklist, budget categories, and
 * team roles. Nothing the module offers in a picker is hard-coded.
 */
export const DEFAULT_PROJECT_REPORT_SECTIONS = [
  'Summary',
  'Progress this period',
  'Issues & risks',
  'Next steps',
]
export const DEFAULT_PROJECT_CLOSE_CHECKLIST = [
  'All milestones complete',
  'Final report approved',
  'Budget reconciled',
  'Client sign-off received',
  'Documents archived',
]
export const DEFAULT_PROJECT_BUDGET_CATEGORIES = [
  'Personnel',
  'Travel & subsistence',
  'Equipment',
  'Subcontractors',
  'Operations',
  'Overheads',
]
export const DEFAULT_PROJECT_TEAM_ROLES = [
  'Project Manager',
  'Team Member',
  'Technical Lead',
  'Finance',
  'M&E',
  'Coordinator',
]

// ── Configurable statuses (P6/P7/P14) ────────────────────────────────────────
// Every status LABEL is org-configurable; each maps to a hidden CATEGORY that
// drives automation. Activity status is the only thing set manually — milestone
// and project state are derived from these categories.
export type StatusCategory = 'not_started' | 'in_progress' | 'done'
export const STATUS_CATEGORIES: StatusCategory[] = ['not_started', 'in_progress', 'done']
export const STATUS_CATEGORY_LABEL: Record<StatusCategory, string> = {
  not_started: 'Not started',
  in_progress: 'In progress',
  done: 'Done',
}
export const STATUS_CATEGORY_COLOR: Record<
  StatusCategory,
  'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'
> = {
  not_started: 'neutral',
  in_progress: 'info',
  done: 'success',
}

export interface ActivityStatusOption {
  label: string
  category: StatusCategory
}
export const DEFAULT_ACTIVITY_STATUSES: ActivityStatusOption[] = [
  { label: 'Not started', category: 'not_started' },
  { label: 'In progress', category: 'in_progress' },
  { label: 'Blocked', category: 'in_progress' },
  { label: 'Completed', category: 'done' },
]

// Labels used to display the DERIVED milestone/project lifecycle state.
export interface LifecycleLabels {
  notStarted: string
  inProgress: string
  done: string
}
export const DEFAULT_LIFECYCLE_LABELS: LifecycleLabels = {
  notStarted: 'Not started',
  inProgress: 'In progress',
  done: 'Completed',
}
export function lifecycleLabel(category: StatusCategory, labels: LifecycleLabels): string {
  return category === 'done'
    ? labels.done
    : category === 'in_progress'
      ? labels.inProgress
      : labels.notStarted
}

export interface ProjectSettings {
  reportSections: string[]
  closeChecklist: string[]
  budgetCategories: string[]
  teamRoles: string[]
  activityStatuses: ActivityStatusOption[]
  lifecycleLabels: LifecycleLabels
  requireBudgetRevisionApproval: boolean
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  reportSections: [...DEFAULT_PROJECT_REPORT_SECTIONS],
  closeChecklist: [...DEFAULT_PROJECT_CLOSE_CHECKLIST],
  budgetCategories: [...DEFAULT_PROJECT_BUDGET_CATEGORIES],
  teamRoles: [...DEFAULT_PROJECT_TEAM_ROLES],
  activityStatuses: DEFAULT_ACTIVITY_STATUSES.map((s) => ({ ...s })),
  lifecycleLabels: { ...DEFAULT_LIFECYCLE_LABELS },
  requireBudgetRevisionApproval: true,
}

const stringList = z.array(z.string().trim().min(1).max(120)).max(40)
export const updateProjectSettingsSchema = z.object({
  reportSections: stringList.min(1, 'Keep at least one report section'),
  closeChecklist: stringList.min(1, 'Keep at least one checklist item'),
  budgetCategories: stringList,
  teamRoles: stringList,
  activityStatuses: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(80),
        category: z.enum(['not_started', 'in_progress', 'done']),
      })
    )
    .min(1, 'Keep at least one activity status')
    .max(20)
    // Must offer at least one "done" status so activities can ever complete.
    .refine((list) => list.some((s) => s.category === 'done'), {
      message: 'Include at least one status in the "Done" category',
    }),
  lifecycleLabels: z.object({
    notStarted: z.string().trim().min(1).max(60),
    inProgress: z.string().trim().min(1).max(60),
    done: z.string().trim().min(1).max(60),
  }),
  requireBudgetRevisionApproval: z.boolean(),
})
export type UpdateProjectSettingsPayload = z.output<typeof updateProjectSettingsSchema>

/**
 * Build the rich-text (HTML) scaffold for a new report — an <h2> heading per
 * required section with an empty paragraph to fill. Matches the Tiptap editor.
 */
export function reportTemplateFromSections(sections: string[]): string {
  return sections.map((s) => `<h2>${s}</h2><p></p>`).join('')
}

function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
}

/**
 * Required sections that are missing or have no content in a report body. Works
 * on the editor's HTML: each section is an <h2> heading whose following content
 * (up to the next heading) must be non-empty.
 */
export function reportMissingSections(
  content: string | null | undefined,
  sections: string[]
): string[] {
  const html = content ?? ''
  const headingRe = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi
  const headings: { text: string; end: number; start: number }[] = []
  let m: RegExpExecArray | null
  while ((m = headingRe.exec(html))) {
    headings.push({
      text: decodeEntities((m[1] ?? '').replace(/<[^>]*>/g, ''))
        .trim()
        .toLowerCase(),
      start: m.index,
      end: headingRe.lastIndex,
    })
  }
  const missing: string[] = []
  for (const label of sections) {
    const key = label.trim().toLowerCase()
    const hIdx = headings.findIndex((h) => h.text === key)
    if (hIdx === -1) {
      missing.push(label)
      continue
    }
    const start = headings[hIdx]!.end
    const nextStart = hIdx + 1 < headings.length ? headings[hIdx + 1]!.start : html.length
    const body = decodeEntities(html.slice(start, nextStart).replace(/<[^>]*>/g, ''))
      .replace(/\s+/g, ' ')
      .trim()
    if (!body) missing.push(label)
  }
  return missing
}
