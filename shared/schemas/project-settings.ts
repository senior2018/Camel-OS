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

export interface ProjectSettings {
  reportSections: string[]
  closeChecklist: string[]
  budgetCategories: string[]
  teamRoles: string[]
  requireBudgetRevisionApproval: boolean
}

export const DEFAULT_PROJECT_SETTINGS: ProjectSettings = {
  reportSections: [...DEFAULT_PROJECT_REPORT_SECTIONS],
  closeChecklist: [...DEFAULT_PROJECT_CLOSE_CHECKLIST],
  budgetCategories: [...DEFAULT_PROJECT_BUDGET_CATEGORIES],
  teamRoles: [...DEFAULT_PROJECT_TEAM_ROLES],
  requireBudgetRevisionApproval: true,
}

const stringList = z.array(z.string().trim().min(1).max(120)).max(40)
export const updateProjectSettingsSchema = z.object({
  reportSections: stringList.min(1, 'Keep at least one report section'),
  closeChecklist: stringList.min(1, 'Keep at least one checklist item'),
  budgetCategories: stringList,
  teamRoles: stringList,
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
