/**
 * Single source of truth for the RBAC catalog used across the platform.
 *
 * - `MODULES` and `ACTIONS` drive the admin permission-matrix UI.
 * - `DEFAULT_ROLES` is what `ensureDefaultRoles()` seeds for each new organization.
 *
 * Modules can be added without a schema migration (they're stored as plain text in
 * `role_permissions.module`), but adding them here keeps the matrix consistent.
 */

export type PermissionAction = 'read' | 'create' | 'update' | 'approve' | 'delete' | 'admin'

export const ACTIONS: readonly PermissionAction[] = [
  'read',
  'create',
  'update',
  // Managerial sign-off, distinct from a plain edit. Drives the opportunity
  // Accept/Reject (Go/No-Go) decision (OM-08): a BD Officer creates + edits,
  // but only a role granted `approve` can accept or reject.
  'approve',
  'delete',
  'admin',
] as const

export interface ModuleDescriptor {
  /** Stored value used in `role_permissions.module`. */
  key: string
  label: string
  description: string
  icon: string
}

export const MODULES: readonly ModuleDescriptor[] = [
  {
    key: 'opportunity',
    label: 'Opportunity Management',
    description: 'Tender and grant pipeline, manual entry, dashboards.',
    icon: 'i-lucide-target',
  },
  {
    key: 'crm',
    label: 'CRM',
    description: 'Clients, donors, partners, contacts, and interactions.',
    icon: 'i-lucide-users',
  },
  {
    key: 'communications',
    label: 'Communications',
    description: 'Content, campaigns, stakeholder engagement, monitoring.',
    icon: 'i-lucide-megaphone',
  },
  {
    key: 'proposal',
    label: 'Proposal Management',
    description: 'Collaborative authoring, reviews, submission tracking.',
    icon: 'i-lucide-file-text',
  },
  {
    key: 'project',
    label: 'Project Management',
    description: 'Engagement delivery, milestones, budgets, timesheets.',
    icon: 'i-lucide-briefcase',
  },
  {
    key: 'mel',
    label: 'Monitoring & Evaluation',
    description: 'Results frameworks, indicators, evidence, evaluations.',
    icon: 'i-lucide-line-chart',
  },
  {
    key: 'hr',
    label: 'HR & Expert Database',
    description: 'Personnel files, expert profiles, certifications.',
    icon: 'i-lucide-user-cog',
  },
  {
    key: 'timesheet',
    label: 'Timesheets',
    description: 'Time entry, approvals, utilisation reporting.',
    icon: 'i-lucide-clock',
  },
  {
    key: 'strategy',
    label: 'Strategy & Goals',
    description: 'Strategic objectives, departmental goals, check-ins.',
    icon: 'i-lucide-flag',
  },
  {
    key: 'finance',
    label: 'Finance',
    description: 'Budgets, expenses, invoices, forecasting.',
    icon: 'i-lucide-banknote',
  },
  {
    key: 'procurement',
    label: 'Procurement',
    description: 'Purchase orders, vendors, RFQs, contracts.',
    icon: 'i-lucide-shopping-cart',
  },
  {
    key: 'knowledge',
    label: 'Knowledge Management',
    description: 'Repositories, taxonomy, search, access control.',
    icon: 'i-lucide-book-open',
  },
  {
    key: 'notifications',
    label: 'Notifications',
    description: 'In-app and email notification configuration.',
    icon: 'i-lucide-bell',
  },
  {
    key: 'admin',
    label: 'Administration',
    description: 'User and role management, password policy, audit log.',
    icon: 'i-lucide-shield',
  },
] as const

const MODULE_KEYS = MODULES.map((m) => m.key)

export function isKnownModule(key: string): boolean {
  return MODULE_KEYS.includes(key)
}

export interface DefaultRoleDefinition {
  name: string
  description: string
  mfaRequired: boolean
  isSystem: boolean
  /** Map of module → permitted actions. Use `'*'` to grant every action. */
  permissions: Record<string, readonly PermissionAction[] | '*'>
}

/**
 * Templates seeded by `ensureDefaultRoles()` whenever an organization is created.
 * Existing rows are not overwritten — admins may rename/edit these freely.
 *
 * The set below mirrors the user-story actors referenced across the platform spec.
 * Roles whose modules aren't built yet have realistic permission scopes pre-defined
 * so they "light up" as those sprints land, with zero extra admin work.
 */
export const DEFAULT_ROLES: readonly DefaultRoleDefinition[] = [
  // ── Core platform roles ──────────────────────────────────────────────────────
  {
    name: 'System Administrator',
    description: 'Full access to every module, including user and role management.',
    mfaRequired: true,
    isSystem: true,
    permissions: Object.fromEntries(MODULES.map((m) => [m.key, '*' as const])),
  },
  {
    name: 'Manager',
    description: 'Operational oversight: read everywhere, act on most modules.',
    mfaRequired: false,
    isSystem: true,
    permissions: {
      opportunity: ['read', 'create', 'update', 'approve'],
      crm: ['read', 'create', 'update'],
      // `approve` = sign off on content items in the approval workflow (CC-03).
      communications: ['read', 'create', 'update', 'approve'],
      // `admin` here = proposal oversight (see every proposal in the org). It
      // does NOT grant content-editing — writing still requires being the Lead
      // or an Editor on that specific proposal (enforced server-side).
      proposal: ['read', 'create', 'update', 'admin'],
      project: ['read', 'create', 'update'],
      mel: ['read', 'create', 'update'],
      // Line managers approve their team's leave (HR-03) and read the team
      // calendar (HR-04) — full personnel-file editing stays with HR Manager.
      hr: ['read', 'update'],
      timesheet: ['read', 'update'],
      strategy: ['read', 'update'],
      finance: ['read'],
      procurement: ['read'],
      knowledge: ['read', 'create', 'update'],
      notifications: ['read'],
    },
  },
  {
    name: 'Staff Member',
    description: 'Baseline access for everyday delivery work.',
    mfaRequired: false,
    isSystem: true,
    permissions: {
      opportunity: ['read'],
      crm: ['read'],
      communications: ['read'],
      proposal: ['read', 'create', 'update'],
      project: ['read', 'update'],
      mel: ['read'],
      timesheet: ['read', 'create', 'update'],
      strategy: ['read'],
      knowledge: ['read'],
      notifications: ['read'],
    },
  },

  // ── Business development & CRM ───────────────────────────────────────────────
  {
    name: 'Business Development Officer',
    description: 'Owns opportunity pipeline, client and donor relationships.',
    mfaRequired: false,
    isSystem: false,
    permissions: {
      opportunity: ['read', 'create', 'update'],
      crm: ['read', 'create', 'update'],
      proposal: ['read', 'create', 'update'],
      knowledge: ['read'],
      notifications: ['read'],
    },
  },

  // ── Communications ───────────────────────────────────────────────────────────
  {
    name: 'Communications Officer',
    description: 'Creates and publishes content; tracks engagement.',
    mfaRequired: false,
    isSystem: false,
    permissions: {
      communications: ['read', 'create', 'update'],
      knowledge: ['read'],
      notifications: ['read'],
    },
  },
  {
    name: 'Communications Lead',
    description: 'Manages campaigns, stakeholders, and content approval workflow.',
    mfaRequired: false,
    isSystem: false,
    permissions: {
      communications: ['read', 'create', 'update', 'delete', 'admin'],
      knowledge: ['read', 'create'],
      notifications: ['read'],
    },
  },

  // ── Proposals & delivery ─────────────────────────────────────────────────────
  {
    name: 'Consultant',
    description: 'Authors proposal sections and contributes to project delivery.',
    mfaRequired: false,
    isSystem: false,
    permissions: {
      proposal: ['read', 'create', 'update'],
      project: ['read', 'update'],
      timesheet: ['read', 'create', 'update'],
      knowledge: ['read'],
      notifications: ['read'],
    },
  },
  {
    name: 'Reviewer',
    description: 'Reviews and annotates proposals; gate-keeps submissions.',
    mfaRequired: false,
    isSystem: false,
    permissions: {
      proposal: ['read', 'update'],
      // Reviewers also sign off on Communications content items (CC-03).
      communications: ['read', 'approve'],
      knowledge: ['read'],
      notifications: ['read'],
    },
  },
  {
    name: 'Project Manager',
    description: 'Runs engagements end-to-end: team, budget, milestones, M&E.',
    mfaRequired: false,
    isSystem: false,
    permissions: {
      project: ['read', 'create', 'update', 'admin'],
      mel: ['read', 'create', 'update'],
      timesheet: ['read', 'update', 'admin'],
      proposal: ['read'],
      crm: ['read'],
      finance: ['read'],
      knowledge: ['read', 'create'],
      notifications: ['read'],
    },
  },

  // ── HR / Finance / Knowledge ─────────────────────────────────────────────────
  {
    name: 'HR Manager',
    description: 'Maintains personnel files, expert profiles, and certifications.',
    mfaRequired: true,
    isSystem: false,
    permissions: {
      hr: ['read', 'create', 'update', 'delete', 'admin'],
      timesheet: ['read', 'admin'],
      strategy: ['read'],
      notifications: ['read'],
    },
  },
  {
    name: 'Finance Officer',
    description: 'Manages budgets, expenses, invoicing, and financial reporting.',
    mfaRequired: true,
    isSystem: false,
    permissions: {
      finance: ['read', 'create', 'update', 'admin'],
      procurement: ['read', 'create', 'update'],
      project: ['read'],
      notifications: ['read'],
    },
  },
  {
    name: 'Knowledge Manager',
    description: 'Curates knowledge repositories, taxonomy, and access policy.',
    mfaRequired: false,
    isSystem: false,
    permissions: {
      knowledge: ['read', 'create', 'update', 'delete', 'admin'],
      // ME-05 — capture & curate lessons learned.
      mel: ['read', 'create', 'update'],
      notifications: ['read'],
    },
  },
] as const

/**
 * Expand a default-role definition into the row-level permission tuples that get
 * inserted into `role_permissions`.
 */
export function expandDefaultPermissions(
  def: DefaultRoleDefinition
): Array<{ module: string; action: PermissionAction }> {
  const rows: Array<{ module: string; action: PermissionAction }> = []
  for (const [module, actions] of Object.entries(def.permissions)) {
    const list = actions === '*' ? ACTIONS : actions
    for (const action of list) rows.push({ module, action })
  }
  return rows
}
