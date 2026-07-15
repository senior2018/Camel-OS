<script setup lang="ts">
import {
  EXPENSE_REQUEST_STATUS_COLOR,
  EXPENSE_REQUEST_STATUS_LABEL,
  PROJECT_REPORT_STATUS_COLOR,
  reportStatusLabel,
} from '@@/shared/schemas/project'
import {
  DEFAULT_PROJECT_SETTINGS,
  STATUS_CATEGORY_COLOR,
  lifecycleLabel,
  type ProjectSettings,
  type StatusCategory,
} from '@@/shared/schemas/project-settings'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can, isSystemAdmin } = await usePermissions()
const { user } = useUserSession()
const myId = computed(() => (user.value as { id?: string } | null)?.id ?? '')
const toast = useToast()
// Nuxt UI v4 forbids an empty-string option value, so "none" choices in the
// pickers use a sentinel that the submit handlers map back to null.
const NONE_OPT = '__none__'

interface Member {
  id: string
  userId: string
  role: string
  allocationPct: number
  firstName: string | null
  lastName: string | null
  email: string | null
}
interface Milestone {
  id: string
  name: string
  dueDate: string | null
  completionCriteria: string | null
  statusCategory: StatusCategory
  orderIndex: number
  completedAt: string | null
}
interface Activity {
  id: string
  milestoneId: string | null
  name: string
  description: string | null
  assignedUserId: string | null
  assigneeFirstName: string | null
  assigneeLastName: string | null
  startDate: string | null
  endDate: string | null
  plannedHours: string | null
  percentComplete: number
  statusLabel: string
  statusCategory: StatusCategory
  dependsOnActivityId: string | null
}
interface BudgetLine {
  id: string
  category: string
  phase: string | null
  originalAmount: string
  revisedAmount: string | null
}
interface Expense {
  id: string
  amount: string
  category: string | null
  expenseDate: string
  description: string | null
}
interface Vendor {
  id: string
  name: string
  contactName: string | null
  contractAmount: string | null
  currency: string
  scope: string | null
  paymentSchedule: string | null
  budgetCategory: string | null
}
interface ReportRow {
  id: string
  title: string
  status: 'draft' | 'in_review' | 'approved'
  kind: string
  authorUserId: string | null
  visibleToMembers: boolean
  authorFirstName: string | null
  authorLastName: string | null
  updatedAt: string
}
interface Project {
  id: string
  name: string
  code: string | null
  description: string | null
  scope: string | null
  status: string
  lifecycleCategory: StatusCategory
  startDate: string | null
  endDate: string | null
  totalBudget: string | null
  currency: string
  clientId: string | null
  clientName: string | null
  proposalId: string | null
  projectManagerUserId: string | null
  createdByUserId: string | null
  pmFirstName: string | null
  pmLastName: string | null
  budgetRevisionStatus: 'none' | 'pending' | 'approved'
  budgetRevisionNote: string | null
  portalToken: string | null
  closedAt: string | null
  closeReason: string | null
  closeChecklist: Record<string, boolean> | null
}
interface ExpenseRequest {
  id: string
  purpose: string
  category: string | null
  amount: string
  status: 'requested' | 'approved' | 'rejected' | 'returned'
  requestedByUserId: string | null
  requesterName: string | null
  approvedByUserId: string | null
  decisionNote: string | null
  spentAmount: string | null
  receiptUrl: string | null
  returnNote: string | null
  returnedAt: string | null
  createdAt: string
}
interface Summary {
  budgetTotal: number
  spent: number
  committed: number
  remaining: number
  burnRate: number
  overBudget: boolean
  milestonesTotal: number
  milestonesDone: number
  overdueMilestones: number
  activitiesTotal: number
  activitiesDone: number
  loggedHours: number
  memberCount: number
}
interface Detail {
  project: Project
  members: Member[]
  milestones: Milestone[]
  activities: Activity[]
  canViewBudget: boolean
  budgetLines: BudgetLine[]
  expenses: Expense[]
  vendors: Vendor[]
  procurementPos: {
    id: string
    poNumber: string
    title: string
    budgetCategory: string | null
    amount: string
    status: string
  }[]
  expenseRequests: ExpenseRequest[]
  reports: ReportRow[]
  timesheetByUser: { userId: string; name: string; hours: number }[]
  timesheetWeekly: {
    weeks: string[]
    rows: { userId: string; name: string; byWeek: Record<string, number>; total: number }[]
  }
  summary: Summary
}

const { data, refresh } = await useFetch<Detail>(`/api/projects/${id}`, { key: `project-${id}` })
if (!data.value)
  throw createError({ statusCode: 404, statusMessage: 'Project not found', fatal: true })
useHead(() => ({ title: `${data.value?.project.name ?? 'Project'} — Camel OS` }))

const { data: usersData } = useFetch<{
  users: { id: string; firstName: string | null; lastName: string | null; email: string }[]
}>('/api/projects/assignable-users', { key: 'project-users', default: () => ({ users: [] }) })
const userItems = computed(() =>
  (usersData.value?.users ?? []).map((u) => ({
    label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    value: u.id,
  }))
)
// Org-configurable project settings (report sections, close checklist, budget
// categories, team roles) — nothing in the pickers is hard-coded.
const { data: settingsData } = useFetch<{ settings: ProjectSettings }>('/api/projects/settings', {
  key: 'project-settings',
  default: () => ({ settings: { ...DEFAULT_PROJECT_SETTINGS } }),
})
const projectSettings = computed(() => settingsData.value?.settings ?? DEFAULT_PROJECT_SETTINGS)

// P4 — link options (clients/donors + unlinked proposals) for the edit form.
const { data: linkOptions } = useFetch<{
  clients: { id: string; name: string; type: string }[]
  proposals: { id: string; title: string; status: string }[]
}>('/api/projects/link-options', {
  key: 'project-link-options',
  default: () => ({ clients: [], proposals: [] }),
})
const clientItems = computed(() => [
  { label: 'No client / donor', value: NONE_OPT },
  ...(linkOptions.value?.clients ?? []).map((c) => ({
    label: c.type && c.type !== 'client' ? `${c.name} · ${c.type}` : c.name,
    value: c.id,
  })),
])
const proposalItems = computed(() => {
  const items = [{ label: 'No proposal', value: NONE_OPT }]
  // Keep the currently-linked proposal selectable even though it's excluded from
  // the "unlinked" options returned by the endpoint.
  const current = data.value?.project.proposalId
  if (current && !(linkOptions.value?.proposals ?? []).some((p) => p.id === current))
    items.push({ label: 'Currently linked proposal', value: current })
  for (const p of linkOptions.value?.proposals ?? []) items.push({ label: p.title, value: p.id })
  return items
})

const userName = (uid: string | null) => {
  if (!uid) return 'Unassigned'
  const u = usersData.value?.users.find((x) => x.id === uid)
  return u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : 'User'
}

const closed = computed(() => !!data.value?.project.closedAt)
const canEdit = computed(() => can.value('project', 'update') && !closed.value)
// Team + ownership are leadership actions: the PM, the creator, or a project
// leader/admin — not every editor.
const isProjectLead = computed(
  () =>
    isSystemAdmin.value ||
    can.value('project', 'admin') ||
    data.value?.project.projectManagerUserId === myId.value ||
    data.value?.project.createdByUserId === myId.value
)
const canManageTeam = computed(() => !closed.value && isProjectLead.value)
const cur = computed(() => data.value?.project.currency ?? 'USD')
function money(v: number | string | null) {
  if (v == null) return '—'
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: cur.value,
    maximumFractionDigits: 0,
  }).format(Number(v))
}
function fdate(s: string | null) {
  return s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
}

type TabKey = 'overview' | 'plan' | 'budget' | 'team' | 'reports' | 'mel'
const canMel = computed(() => can.value('mel', 'read'))
// P8 — the budget/finances are only visible to the PM/lead + finance.
const canViewBudget = computed(() => !!data.value?.canViewBudget)
const tab = ref<TabKey>('overview')
const tabs = computed<{ key: TabKey; label: string; icon: string }[]>(() => [
  { key: 'overview', label: 'Overview', icon: 'i-lucide-gauge' },
  { key: 'plan', label: 'Plan', icon: 'i-lucide-list-checks' },
  ...(canViewBudget.value
    ? [{ key: 'budget' as TabKey, label: 'Budget', icon: 'i-lucide-wallet' }]
    : []),
  { key: 'team', label: 'Team', icon: 'i-lucide-users' },
  { key: 'reports', label: 'Reports', icon: 'i-lucide-file-text' },
  ...(canMel.value ? [{ key: 'mel' as TabKey, label: 'M&E', icon: 'i-lucide-line-chart' }] : []),
])
// If a non-privileged viewer is somehow on the budget tab, bounce to overview.
watchEffect(() => {
  if (tab.value === 'budget' && !canViewBudget.value) tab.value = 'overview'
})

// RAG helpers for the health dashboard (PJ-10).
const scheduleRag = computed(() => {
  const s = data.value?.summary
  if (!s) return 'neutral'
  if (s.overdueMilestones > 0) return 'error'
  if (s.milestonesTotal && s.milestonesDone / s.milestonesTotal < 0.5) return 'warning'
  return 'success'
})
const budgetRag = computed(() => {
  const r = data.value?.summary.burnRate ?? 0
  if (r > 100) return 'error'
  if (r > 85) return 'warning'
  return 'success'
})
const ragClass = (r: string) =>
  ({
    success: 'text-success',
    warning: 'text-warning',
    error: 'text-error',
    neutral: 'text-muted',
  })[r] ?? 'text-muted'

// Every mutating action goes through here: a shared `busy` flag disables the
// buttons and swallows rapid repeat clicks, and success/error always toasts so
// nothing happens silently.
const busy = ref(false)
async function call(method: string, path: string, body?: Record<string, unknown>, ok?: string) {
  if (busy.value) return false
  busy.value = true
  try {
    await $fetch(`/api/projects/${id}${path}` as string, { method: method as 'POST', body })
    toast.add({ title: ok ?? 'Saved', color: 'success' })
    await refresh()
    return true
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Action failed', description: msg, color: 'error' })
    return false
  } finally {
    busy.value = false
  }
}

// ── PM (project status is derived, never set by hand) ──
const pmId = ref<string | undefined>(undefined)
watchEffect(() => {
  pmId.value = data.value?.project.projectManagerUserId ?? undefined
})
async function saveHeader() {
  await call('PATCH', '', { projectManagerUserId: pmId.value ?? null }, 'Project manager updated')
}

// Configurable statuses + derived-lifecycle display helpers.
const activityStatusItems = computed(() =>
  projectSettings.value.activityStatuses.map((s) => ({ label: s.label, value: s.label }))
)
const catColor = (c: StatusCategory) => STATUS_CATEGORY_COLOR[c]
const lifeLabel = (c: StatusCategory) => lifecycleLabel(c, projectSettings.value.lifecycleLabels)
// Only the assignee or a project lead may move an activity's status (P14/P21).
const canEditActivityStatus = (a: Activity) =>
  !closed.value && (isProjectLead.value || a.assignedUserId === myId.value)
async function updateActivityStatus(a: Activity, statusLabel: string) {
  await call('PATCH', `/activities/${a.id}`, { statusLabel })
}

// ── Edit project details (P3) + linking (P4) — leads only ──
const editOpen = ref(false)
const editForm = reactive({
  name: '',
  code: '',
  description: '',
  scope: '',
  startDate: '',
  endDate: '',
  totalBudget: null as number | null,
  currency: 'USD',
  clientId: NONE_OPT as string,
  proposalId: NONE_OPT as string,
})
function openEdit() {
  const p = data.value?.project
  if (!p) return
  editForm.name = p.name
  editForm.code = p.code ?? ''
  editForm.description = p.description ?? ''
  editForm.scope = p.scope ?? ''
  editForm.startDate = p.startDate ?? ''
  editForm.endDate = p.endDate ?? ''
  editForm.totalBudget = p.totalBudget != null ? Number(p.totalBudget) : null
  editForm.currency = p.currency ?? 'USD'
  editForm.clientId = p.clientId ?? NONE_OPT
  editForm.proposalId = p.proposalId ?? NONE_OPT
  editOpen.value = true
}
async function saveEdit() {
  if (!editForm.name.trim()) {
    toast.add({ title: 'A project name is required', color: 'warning' })
    return
  }
  const ok = await call(
    'PATCH',
    '',
    {
      name: editForm.name.trim(),
      code: editForm.code.trim() || null,
      description: editForm.description.trim() || null,
      scope: editForm.scope.trim() || null,
      startDate: editForm.startDate || null,
      endDate: editForm.endDate || null,
      totalBudget: editForm.totalBudget != null ? Number(editForm.totalBudget) : null,
      currency: (editForm.currency || 'USD').toUpperCase(),
      clientId: editForm.clientId === NONE_OPT ? null : editForm.clientId,
      proposalId: editForm.proposalId === NONE_OPT ? null : editForm.proposalId,
    },
    'Project updated'
  )
  if (ok) editOpen.value = false
}

// ── Reopen a closed project (P19) ──
async function reopenProject() {
  await call('POST', '/reopen', undefined, 'Project reopened')
}

// ── Team (PJ-02) ──
const team = ref<{ userId: string; role: string; allocationPct: number }[]>([])
watchEffect(() => {
  team.value = (data.value?.members ?? []).map((m) => ({
    userId: m.userId,
    role: m.role,
    allocationPct: m.allocationPct,
  }))
})
const addMemberId = ref<string | undefined>(undefined)
const addMemberRole = ref<string>('')
// Configured team roles for the picker (falls back to a sensible default).
const teamRoleItems = computed(() =>
  projectSettings.value.teamRoles.map((r) => ({ label: r, value: r }))
)
function addMember() {
  if (!addMemberId.value || team.value.some((t) => t.userId === addMemberId.value)) return
  const role = addMemberRole.value || projectSettings.value.teamRoles[1] || 'Team Member'
  team.value.push({ userId: addMemberId.value, role, allocationPct: 100 })
  addMemberId.value = undefined
  addMemberRole.value = ''
}
async function saveTeam() {
  await call('PUT', '/members', { members: team.value }, 'Team saved')
}

// ── Milestones (PJ-03) — PM/lead only; status is derived (P14/P21). ──
const msOpen = ref(false)
const msForm = reactive({
  id: null as string | null,
  name: '',
  dueDate: '',
  completionCriteria: '',
})
function openMilestoneCreate() {
  msForm.id = null
  msForm.name = ''
  msForm.dueDate = ''
  msForm.completionCriteria = ''
  msOpen.value = true
}
function openMilestoneEdit(m: Milestone) {
  msForm.id = m.id
  msForm.name = m.name
  msForm.dueDate = m.dueDate ?? ''
  msForm.completionCriteria = m.completionCriteria ?? ''
  msOpen.value = true
}
async function saveMilestone() {
  if (!msForm.name.trim()) return
  const body = {
    name: msForm.name.trim(),
    dueDate: msForm.dueDate || null,
    completionCriteria: msForm.completionCriteria || null,
  }
  const ok = msForm.id
    ? await call('PATCH', `/milestones/${msForm.id}`, body, 'Milestone updated')
    : await call('POST', '/milestones', body)
  if (ok) msOpen.value = false
}
// ── Activities (PJ-04) ──
const actOpen = ref(false)
const actForm = reactive({
  name: '',
  milestoneId: NONE_OPT,
  assignedUserId: NONE_OPT,
  dependsOnActivityId: NONE_OPT,
  startDate: '',
  endDate: '',
  plannedHours: null as number | null,
})
// PJ-04 — existing activities to pick as a dependency ("depends on").
const activityItems = computed(() => [
  { label: 'No dependency', value: NONE_OPT },
  ...(data.value?.activities ?? []).map((a) => ({ label: a.name, value: a.id })),
])
const activityName = (aid: string | null) =>
  data.value?.activities.find((a) => a.id === aid)?.name ?? null
async function addActivity() {
  if (!actForm.name.trim()) return
  if (
    await call('POST', '/activities', {
      name: actForm.name,
      milestoneId: actForm.milestoneId === NONE_OPT ? null : actForm.milestoneId || null,
      assignedUserId: actForm.assignedUserId === NONE_OPT ? null : actForm.assignedUserId || null,
      dependsOnActivityId:
        actForm.dependsOnActivityId === NONE_OPT ? null : actForm.dependsOnActivityId || null,
      startDate: actForm.startDate || null,
      endDate: actForm.endDate || null,
      plannedHours: actForm.plannedHours,
    })
  ) {
    actOpen.value = false
    actForm.name = ''
    actForm.milestoneId = NONE_OPT
    actForm.assignedUserId = NONE_OPT
    actForm.dependsOnActivityId = NONE_OPT
    actForm.startDate = ''
    actForm.endDate = ''
    actForm.plannedHours = null
  }
}

// ── Budget revision approval (PJ-05) ──
const canApproveRevision = computed(
  () => can.value('project', 'admin') || can.value('admin', 'admin')
)
async function approveRevision(approve: boolean) {
  await call(
    'POST',
    '/budget/approve-revision',
    { approve },
    approve ? 'Budget revision approved' : 'Budget revision rejected'
  )
}

// ── Budget (PJ-05) ──
const lines = ref<
  { category: string; phase: string; originalAmount: number; revisedAmount: number | null }[]
>([])
watchEffect(() => {
  lines.value = (data.value?.budgetLines ?? []).map((l) => ({
    category: l.category,
    phase: l.phase ?? '',
    originalAmount: Number(l.originalAmount),
    revisedAmount: l.revisedAmount != null ? Number(l.revisedAmount) : null,
  }))
})
function addLine() {
  lines.value.push({ category: '', phase: '', originalAmount: 0, revisedAmount: null })
}
// ── Connected budget: expenses (actual) + vendors & approved requests
// (committed) roll up to their budget category, so the plan reflects reality. ──
const spentByLine = computed(() => {
  const m: Record<string, number> = {}
  for (const e of data.value?.expenses ?? [])
    m[e.category ?? ''] = (m[e.category ?? ''] ?? 0) + Number(e.amount)
  return m
})
const committedByLine = computed(() => {
  const m: Record<string, number> = {}
  // Approved (not yet returned) funds requests are committed against their category.
  for (const r of data.value?.expenseRequests ?? [])
    if (r.status === 'approved') m[r.category ?? ''] = (m[r.category ?? ''] ?? 0) + Number(r.amount)
  // Vendor contracts are committed against their linked budget category.
  for (const v of data.value?.vendors ?? [])
    if (v.contractAmount != null)
      m[v.budgetCategory ?? ''] = (m[v.budgetCategory ?? ''] ?? 0) + Number(v.contractAmount)
  // Procurement POs (past draft) commit against their budget category too.
  const poCommitted = new Set(['approved', 'committed', 'received', 'closed'])
  for (const p of data.value?.procurementPos ?? [])
    if (poCommitted.has(p.status))
      m[p.budgetCategory ?? ''] = (m[p.budgetCategory ?? ''] ?? 0) + Number(p.amount)
  return m
})
const lineRemaining = (l: {
  category: string
  originalAmount: number
  revisedAmount: number | null
}) =>
  Number(l.revisedAmount ?? l.originalAmount ?? 0) -
  (spentByLine.value[l.category] ?? 0) -
  (committedByLine.value[l.category] ?? 0)
const budgetTotals = computed(() => {
  let original = 0
  let revised = 0
  let actual = 0
  let committed = 0
  for (const l of lines.value) {
    original += Number(l.originalAmount || 0)
    revised += Number(l.revisedAmount ?? l.originalAmount ?? 0)
    actual += spentByLine.value[l.category] ?? 0
    committed += committedByLine.value[l.category] ?? 0
  }
  return { original, revised, actual, committed, remaining: revised - actual - committed }
})
async function saveBudget() {
  await call(
    'PUT',
    '/budget',
    {
      lines: lines.value
        .filter((l) => l.category.trim())
        .map((l) => ({
          category: l.category.trim(),
          phase: l.phase || null,
          originalAmount: Number(l.originalAmount || 0),
          revisedAmount: l.revisedAmount != null ? Number(l.revisedAmount) : null,
        })),
    },
    'Budget saved'
  )
}

// ── Expenses (PJ-07) ── recording is owned by the Finance Officer (finance
// perms) as well as the PM (project:update).
const canRecordExpense = computed(
  () =>
    !closed.value &&
    (can.value('project', 'update') ||
      can.value('finance', 'create') ||
      can.value('finance', 'update'))
)
const expOpen = ref(false)
const expForm = reactive({
  id: null as string | null,
  amount: null as number | null,
  category: NONE_OPT as string,
  expenseDate: new Date().toISOString().slice(0, 10),
  description: '',
  receiptUrl: '',
})
function openExpense(e?: Expense) {
  expForm.id = e?.id ?? null
  expForm.amount = e ? Number(e.amount) : null
  expForm.category = e?.category ?? NONE_OPT
  expForm.expenseDate = e?.expenseDate ?? new Date().toISOString().slice(0, 10)
  expForm.description = e?.description ?? ''
  expForm.receiptUrl = ''
  expOpen.value = true
}
async function saveExpense() {
  if (expForm.amount == null) return
  const body = {
    amount: expForm.amount,
    category: expForm.category === NONE_OPT ? null : expForm.category,
    expenseDate: expForm.expenseDate,
    description: expForm.description || null,
    receiptUrl: expForm.receiptUrl || '',
  }
  const ok = expForm.id
    ? await call('PATCH', `/expenses/${expForm.id}`, body, 'Expense updated')
    : await call('POST', '/expenses', body)
  if (ok) expOpen.value = false
}

// Budget categories for a budget-line picker (configured + already-used), with a
// creatable free-text fallback.
const lineCategoryItems = computed(() => {
  const seen = new Set<string>()
  const out: string[] = []
  for (const c of [
    ...projectSettings.value.budgetCategories,
    ...(data.value?.budgetLines ?? []).map((l) => l.category),
  ]) {
    if (c && !seen.has(c)) {
      seen.add(c)
      out.push(c)
    }
  }
  return out
})

// ── Expense requests → approval → return (P9) ──
const canApproveExpense = computed(() => canViewBudget.value && !closed.value)
const reqOpen = ref(false)
const reqForm = reactive({
  id: null as string | null,
  purpose: '',
  category: NONE_OPT as string,
  amount: null as number | null,
})
function openRequest(r?: ExpenseRequest) {
  reqForm.id = r?.id ?? null
  reqForm.purpose = r?.purpose ?? ''
  reqForm.category = r?.category ?? NONE_OPT
  reqForm.amount = r ? Number(r.amount) : null
  reqOpen.value = true
}
async function submitRequest() {
  if (!reqForm.purpose.trim() || reqForm.amount == null) return
  const body = {
    purpose: reqForm.purpose.trim(),
    category: reqForm.category === NONE_OPT ? null : reqForm.category,
    amount: Number(reqForm.amount),
  }
  const ok = reqForm.id
    ? await call('PATCH', `/expense-requests/${reqForm.id}`, body, 'Request updated')
    : await call('POST', '/expense-requests', body, 'Request submitted')
  if (ok) reqOpen.value = false
}
// In-flight requests (returned ones become recorded expenses, so are hidden here).
const pendingRequests = computed(() =>
  (data.value?.expenseRequests ?? []).filter((r) => r.status !== 'returned')
)
async function decideRequest(r: ExpenseRequest, approve: boolean) {
  await call(
    'POST',
    `/expense-requests/${r.id}/approve`,
    { approve },
    approve ? 'Request approved' : 'Request rejected'
  )
}
const retOpen = ref(false)
const retTarget = ref<ExpenseRequest | null>(null)
const retForm = reactive({ spentAmount: null as number | null, receiptUrl: '', returnNote: '' })
function openReturn(r: ExpenseRequest) {
  retTarget.value = r
  retForm.spentAmount = Number(r.amount)
  retForm.receiptUrl = ''
  retForm.returnNote = ''
  retOpen.value = true
}
async function submitReturn() {
  if (!retTarget.value || retForm.spentAmount == null) return
  if (!retForm.receiptUrl.trim()) {
    toast.add({ title: 'A receipt link is required', color: 'warning' })
    return
  }
  if (
    await call(
      'POST',
      `/expense-requests/${retTarget.value.id}/return`,
      {
        spentAmount: Number(retForm.spentAmount),
        receiptUrl: retForm.receiptUrl.trim(),
        returnNote: retForm.returnNote || null,
      },
      'Expense returned'
    )
  ) {
    retOpen.value = false
    retTarget.value = null
  }
}
const canReturn = (r: ExpenseRequest) =>
  !closed.value &&
  r.status === 'approved' &&
  (r.requestedByUserId === myId.value || canViewBudget.value)

// ── Vendors (PJ-08) — a vendor's contract can be linked to a budget line. ──
const venOpen = ref(false)
const venForm = reactive({
  id: null as string | null,
  name: '',
  contactName: '',
  contactEmail: '',
  contractAmount: null as number | null,
  currency: 'USD',
  scope: '',
  paymentSchedule: '',
  budgetCategory: NONE_OPT as string,
})
function openVendor(v?: Vendor) {
  venForm.id = v?.id ?? null
  venForm.name = v?.name ?? ''
  venForm.contactName = v?.contactName ?? ''
  venForm.contactEmail = ''
  venForm.contractAmount = v?.contractAmount != null ? Number(v.contractAmount) : null
  venForm.currency = v?.currency ?? 'USD'
  venForm.scope = v?.scope ?? ''
  venForm.paymentSchedule = v?.paymentSchedule ?? ''
  venForm.budgetCategory = v?.budgetCategory ?? NONE_OPT
  venOpen.value = true
}
// Budget categories to link a vendor against: the configured vocabulary plus
// any categories already used on this project's budget lines.
const budgetCategoryItems = computed(() => {
  const seen = new Set<string>()
  const items = [{ label: 'No budget line', value: NONE_OPT }]
  for (const c of [
    ...projectSettings.value.budgetCategories,
    ...(data.value?.budgetLines ?? []).map((l) => l.category),
  ]) {
    if (c && !seen.has(c)) {
      seen.add(c)
      items.push({ label: c, value: c })
    }
  }
  return items
})
async function saveVendor() {
  if (!venForm.name.trim()) return
  const body = {
    name: venForm.name,
    contactName: venForm.contactName || null,
    contactEmail: venForm.contactEmail || '',
    contractAmount: venForm.contractAmount,
    currency: venForm.currency || 'USD',
    scope: venForm.scope || null,
    paymentSchedule: venForm.paymentSchedule || null,
    budgetCategory: venForm.budgetCategory === NONE_OPT ? null : venForm.budgetCategory,
  }
  const ok = venForm.id
    ? await call('PATCH', `/vendors/${venForm.id}`, body, 'Vendor updated')
    : await call('POST', '/vendors', body)
  if (ok) venOpen.value = false
}

// ── Reports (PJ-09 / P17) — free-form; open in a full-page editor. ──
const creatingReport = ref(false)
async function newReport(kind: 'activity' | 'general') {
  if (creatingReport.value) return
  creatingReport.value = true
  try {
    const res = await $fetch<{ report: { id: string } }>(`/api/projects/${id}/reports`, {
      method: 'POST',
      body: {
        title: kind === 'general' ? 'Project report' : 'My activity report',
        kind,
        content: '',
      },
    })
    await navigateTo(`/projects/${id}/reports/${res.report.id}`)
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not create report', description: msg, color: 'error' })
  } finally {
    creatingReport.value = false
  }
}

// ── Timesheet (PJ-06) ──
const tsOpen = ref(false)
const tsForm = reactive({
  activityId: NONE_OPT,
  entryDate: new Date().toISOString().slice(0, 10),
  hours: null as number | null,
  note: '',
})
async function logTime() {
  if (tsForm.hours == null) return
  if (
    await call(
      'POST',
      '/timesheet',
      {
        activityId: tsForm.activityId === NONE_OPT ? null : tsForm.activityId || null,
        entryDate: tsForm.entryDate,
        hours: tsForm.hours,
        note: tsForm.note || null,
      },
      'Time logged'
    )
  ) {
    tsOpen.value = false
    tsForm.activityId = NONE_OPT
    tsForm.hours = null
    tsForm.note = ''
  }
}

// ── Close (PJ-11) — checklist items come from settings; reason required (P20). ──
const closeOpen = ref(false)
const checklist = ref<Record<string, boolean>>({})
const closeReason = ref('')
function openClose() {
  checklist.value = Object.fromEntries(projectSettings.value.closeChecklist.map((i) => [i, false]))
  closeReason.value = ''
  closeOpen.value = true
}
const closing = ref(false)
async function closeProject() {
  if (closeReason.value.trim().length < 3) {
    toast.add({ title: 'Give a reason for closing', color: 'warning' })
    return
  }
  closing.value = true
  if (
    await call(
      'POST',
      '/close',
      { checklist: { ...checklist.value }, reason: closeReason.value.trim() },
      'Project closed'
    )
  )
    closeOpen.value = false
  closing.value = false
}

const milestoneItems = computed(() => [
  { label: 'No milestone', value: NONE_OPT },
  ...(data.value?.milestones ?? []).map((m) => ({ label: m.name, value: m.id })),
])

// ── Plan view (P13/P15): board (collapsible milestones) vs Gantt, with search
// and status filter, and pagination when there are many milestones. ──
const planView = ref<'board' | 'gantt'>('board')
const planSearch = ref('')
const ALL_CAT = '__all__'
const planCat = ref<StatusCategory | typeof ALL_CAT>(ALL_CAT)
const planCatItems = [
  { label: 'Any status', value: ALL_CAT },
  { label: 'Not started', value: 'not_started' },
  { label: 'In progress', value: 'in_progress' },
  { label: 'Done', value: 'done' },
]
const collapsed = reactive<Record<string, boolean>>({})
const toggleCollapse = (mid: string) => {
  collapsed[mid] = !collapsed[mid]
}
function activityMatches(a: Activity) {
  const q = planSearch.value.trim().toLowerCase()
  if (planCat.value !== ALL_CAT && a.statusCategory !== planCat.value) return false
  if (q && !a.name.toLowerCase().includes(q)) return false
  return true
}
const activitiesFor = (mid: string | null) =>
  (data.value?.activities ?? []).filter((a) => a.milestoneId === mid && activityMatches(a))
const filtering = computed(() => planSearch.value.trim() !== '' || planCat.value !== ALL_CAT)
// Milestones to show: when filtering, only those whose name matches or that hold
// a matching activity.
const shownMilestones = computed(() => {
  const q = planSearch.value.trim().toLowerCase()
  return (data.value?.milestones ?? []).filter((m) => {
    if (!filtering.value) return true
    if (q && m.name.toLowerCase().includes(q) && planCat.value === ALL_CAT) return true
    return activitiesFor(m.id).length > 0
  })
})
const msPage = ref(1)
const msPageSize = 8
const pagedMilestones = computed(() =>
  shownMilestones.value.slice((msPage.value - 1) * msPageSize, msPage.value * msPageSize)
)
watch([planSearch, planCat], () => {
  msPage.value = 1
})
const unscheduled = computed(() => activitiesFor(null))
function openActivity(a: Activity) {
  navigateTo(`/projects/${id}/activities/${a.id}`)
}
</script>

<template>
  <div v-if="data" class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-default/70 pb-5">
      <div>
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="All projects"
          class="-ml-2"
          @click="navigateTo('/projects')"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight text-default">
            {{ data.project.name }}
          </h1>
          <UBadge v-if="closed" color="neutral" variant="subtle" label="Closed" />
          <UBadge
            v-else
            :color="catColor(data.project.lifecycleCategory)"
            variant="subtle"
            :label="lifeLabel(data.project.lifecycleCategory)"
          />
          <UBadge
            v-if="data.project.code"
            color="neutral"
            variant="outline"
            :label="data.project.code"
          />
        </div>
        <p class="mt-1 text-sm text-muted">
          {{ data.project.clientName || 'No client' }} · PM:
          {{ userName(data.project.projectManagerUserId) }}
          <span v-if="data.project.proposalId"> · from won proposal</span>
        </p>
      </div>
      <div class="flex items-center gap-2">
        <UButton
          v-if="isProjectLead && !closed"
          icon="i-lucide-pencil"
          color="neutral"
          variant="outline"
          label="Edit"
          @click="openEdit()"
        />
        <UButton
          v-if="isProjectLead && !closed"
          icon="i-lucide-flag"
          color="neutral"
          variant="outline"
          label="Close project"
          @click="openClose()"
        />
        <UButton
          v-if="isProjectLead && closed"
          icon="i-lucide-rotate-ccw"
          color="neutral"
          variant="outline"
          label="Reopen"
          :loading="busy"
          @click="reopenProject()"
        />
      </div>
    </div>

    <div
      v-if="closed"
      class="rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm text-warning"
    >
      <UIcon name="i-lucide-archive" class="inline size-4" /> Closed
      {{ fdate(data.project.closedAt) }} — archived &amp; read-only.
      <span v-if="data.project.closeReason" class="text-default"
        >· Reason: {{ data.project.closeReason }}</span
      >
    </div>

    <!-- Tabs -->
    <div class="flex gap-1 overflow-x-auto border-b border-default">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="flex items-center gap-1.5 border-b-2 px-3 py-2 text-sm font-medium transition-colors"
        :class="
          tab === t.key
            ? 'border-primary text-primary'
            : 'border-transparent text-muted hover:text-default'
        "
        @click="tab = t.key"
      >
        <UIcon :name="t.icon" class="size-4" /> {{ t.label }}
      </button>
    </div>

    <!-- OVERVIEW (PJ-10) -->
    <div v-show="tab === 'overview'" class="space-y-5">
      <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Schedule</p>
          <p class="mt-1 text-2xl font-semibold" :class="ragClass(scheduleRag)">
            {{ data.summary.milestonesDone }}/{{ data.summary.milestonesTotal }}
          </p>
          <p class="text-xs text-muted">{{ data.summary.overdueMilestones }} overdue</p>
        </div>
        <div v-if="canViewBudget" class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Budget burn</p>
          <p class="mt-1 text-2xl font-semibold" :class="ragClass(budgetRag)">
            {{ data.summary.burnRate }}%
          </p>
          <p class="text-xs text-muted">
            {{ money(data.summary.spent) }} / {{ money(data.summary.budgetTotal) }}
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Delivery</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ data.summary.activitiesDone }}/{{ data.summary.activitiesTotal }}
          </p>
          <p class="text-xs text-muted">activities done</p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Effort</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ data.summary.loggedHours }}h</p>
          <p class="text-xs text-muted">{{ data.summary.memberCount }} team members</p>
        </div>
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-default">Timeline</h3>
            <UButton
              v-if="!closed"
              size="xs"
              variant="soft"
              icon="i-lucide-clock"
              label="Log time"
              @click="tsOpen = true"
            />
          </div>
        </template>
        <ProjectGantt
          :milestones="data.milestones"
          :activities="data.activities"
          :project-start="data.project.startDate"
          :project-end="data.project.endDate"
        />
      </UCard>

      <UCard v-if="data.project.scope">
        <template #header><h3 class="text-sm font-semibold text-default">Scope</h3></template>
        <p class="whitespace-pre-wrap text-sm text-default">{{ data.project.scope }}</p>
      </UCard>
    </div>

    <!-- PLAN (PJ-03/04, P13/P15) -->
    <div v-show="tab === 'plan'" class="space-y-4">
      <div class="flex flex-wrap items-center gap-2">
        <div class="flex rounded-lg border border-default p-0.5">
          <button
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            :class="planView === 'board' ? 'bg-elevated text-default' : 'text-muted'"
            @click="planView = 'board'"
          >
            <UIcon name="i-lucide-list-checks" class="mr-1 inline size-3.5" />Board
          </button>
          <button
            class="rounded-md px-2.5 py-1 text-xs font-medium transition-colors"
            :class="planView === 'gantt' ? 'bg-elevated text-default' : 'text-muted'"
            @click="planView = 'gantt'"
          >
            <UIcon name="i-lucide-bar-chart-3" class="mr-1 inline size-3.5" />Gantt
          </button>
        </div>
        <UInput
          v-if="planView === 'board'"
          v-model="planSearch"
          icon="i-lucide-search"
          placeholder="Search activities…"
          size="sm"
          class="w-full sm:w-56"
        />
        <USelect
          v-if="planView === 'board'"
          v-model="planCat"
          :items="planCatItems"
          value-key="value"
          size="sm"
          class="w-40"
        />
        <div class="ml-auto flex gap-2">
          <UButton
            v-if="canManageTeam"
            size="sm"
            variant="outline"
            icon="i-lucide-flag"
            label="Add milestone"
            @click="openMilestoneCreate()"
          />
          <UButton
            v-if="canEdit"
            size="sm"
            icon="i-lucide-plus"
            label="Add activity"
            @click="actOpen = true"
          />
        </div>
      </div>

      <!-- GANTT VIEW -->
      <UCard v-if="planView === 'gantt'">
        <ProjectGantt
          :milestones="data.milestones"
          :activities="data.activities"
          :project-start="data.project.startDate"
          :project-end="data.project.endDate"
        />
      </UCard>

      <!-- BOARD VIEW -->
      <template v-else>
        <UCard v-for="m in pagedMilestones" :key="m.id">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <button
                class="flex min-w-0 items-center gap-2 text-left"
                @click="toggleCollapse(m.id)"
              >
                <UIcon
                  :name="collapsed[m.id] ? 'i-lucide-chevron-right' : 'i-lucide-chevron-down'"
                  class="size-4 shrink-0 text-muted"
                />
                <h3 class="truncate text-sm font-semibold text-default">{{ m.name }}</h3>
                <UBadge
                  :color="catColor(m.statusCategory)"
                  variant="subtle"
                  size="xs"
                  :label="lifeLabel(m.statusCategory)"
                />
                <span v-if="m.dueDate" class="text-xs text-muted">due {{ fdate(m.dueDate) }}</span>
                <span class="text-xs text-dimmed">· {{ activitiesFor(m.id).length }}</span>
              </button>
              <div v-if="canManageTeam" class="flex items-center gap-1">
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-pencil"
                  aria-label="Edit milestone"
                  @click="openMilestoneEdit(m)"
                />
                <UButton
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-trash-2"
                  aria-label="Delete milestone"
                  @click="call('DELETE', `/milestones/${m.id}`)"
                />
              </div>
            </div>
          </template>
          <ul v-show="!collapsed[m.id]" class="divide-y divide-default">
            <li
              v-for="a in activitiesFor(m.id)"
              :key="a.id"
              class="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <button class="min-w-0 flex-1 text-left" @click="openActivity(a)">
                <p class="truncate text-sm font-medium text-default hover:text-primary">
                  {{ a.name }}
                </p>
                <p class="text-xs text-muted">
                  {{ userName(a.assignedUserId) }} · {{ fdate(a.startDate) }}–{{ fdate(a.endDate) }}
                </p>
                <p v-if="a.dependsOnActivityId" class="text-xs text-muted">
                  <UIcon name="i-lucide-link" class="inline size-3" /> after
                  {{ activityName(a.dependsOnActivityId) }}
                </p>
              </button>
              <div class="flex items-center gap-2">
                <div class="h-1.5 w-16 overflow-hidden rounded-full bg-elevated">
                  <div class="h-full bg-primary" :style="{ width: `${a.percentComplete}%` }" />
                </div>
                <USelect
                  v-if="canEditActivityStatus(a)"
                  :model-value="a.statusLabel"
                  :items="activityStatusItems"
                  value-key="value"
                  size="xs"
                  class="w-32"
                  @update:model-value="(v) => updateActivityStatus(a, v as string)"
                />
                <UBadge
                  v-else
                  :color="catColor(a.statusCategory)"
                  variant="subtle"
                  size="xs"
                  :label="a.statusLabel"
                />
                <UButton
                  v-if="canEdit"
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-x"
                  aria-label="Delete activity"
                  @click="call('DELETE', `/activities/${a.id}`)"
                />
              </div>
            </li>
            <li v-if="!activitiesFor(m.id).length" class="py-2 text-xs text-muted">
              No activities{{ filtering ? ' match' : ' yet' }}.
            </li>
          </ul>
        </UCard>

        <div v-if="shownMilestones.length > msPageSize" class="flex justify-center">
          <UPagination
            v-model:page="msPage"
            :total="shownMilestones.length"
            :items-per-page="msPageSize"
            :sibling-count="1"
          />
        </div>

        <UCard v-if="unscheduled.length">
          <template #header
            ><h3 class="text-sm font-semibold text-default">Unscheduled activities</h3></template
          >
          <ul class="divide-y divide-default">
            <li
              v-for="a in unscheduled"
              :key="a.id"
              class="flex items-center justify-between gap-2 py-2"
            >
              <button class="min-w-0 flex-1 text-left" @click="openActivity(a)">
                <p class="truncate text-sm text-default hover:text-primary">{{ a.name }}</p>
              </button>
              <UBadge
                :color="catColor(a.statusCategory)"
                variant="subtle"
                size="xs"
                :label="a.statusLabel"
              />
            </li>
          </ul>
        </UCard>

        <p
          v-if="!data.milestones.length && !unscheduled.length"
          class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
        >
          No milestones yet.
        </p>
      </template>
    </div>

    <!-- BUDGET (PJ-05/07/08, P8/P10) -->
    <div v-show="tab === 'budget' && canViewBudget" class="space-y-4">
      <!-- P10 — live running balance: budget vs committed (vendors + approved
           requests) vs actual (expenses). All figures react to edits below. -->
      <div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Budget</p>
          <p class="mt-1 text-xl font-semibold text-default">{{ money(budgetTotals.revised) }}</p>
          <p class="text-xs text-muted">revised where set</p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Committed</p>
          <p class="mt-1 text-xl font-semibold text-default">{{ money(budgetTotals.committed) }}</p>
          <p class="text-xs text-muted">vendors + approved requests</p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Actual spent</p>
          <p class="mt-1 text-xl font-semibold text-default">{{ money(budgetTotals.actual) }}</p>
          <p class="text-xs text-muted">
            {{
              budgetTotals.revised
                ? Math.round((budgetTotals.actual / budgetTotals.revised) * 100)
                : 0
            }}% of budget
          </p>
        </div>
        <div
          class="rounded-xl border p-4 shadow-sm"
          :class="
            budgetTotals.remaining < 0
              ? 'border-error/40 bg-error/5'
              : 'border-success/40 bg-success/5'
          "
        >
          <p class="text-xs uppercase tracking-wide text-muted">Remaining</p>
          <p
            class="mt-1 text-xl font-semibold"
            :class="budgetTotals.remaining < 0 ? 'text-error' : 'text-success'"
          >
            {{ money(budgetTotals.remaining) }}
          </p>
          <p class="text-xs text-muted">budget − committed − actual</p>
        </div>
      </div>

      <div
        v-if="budgetTotals.actual > budgetTotals.revised && budgetTotals.revised > 0"
        class="flex items-center gap-2 rounded-lg border border-error/40 bg-error/5 px-3 py-2 text-sm text-error"
      >
        <UIcon name="i-lucide-alert-triangle" class="size-4 shrink-0" />
        Actual spend has exceeded the budget by
        {{ money(budgetTotals.actual - budgetTotals.revised) }}.
      </div>

      <!-- PJ-05 — a revised budget must be signed off by a manager. -->
      <div
        v-if="data.project.budgetRevisionStatus === 'pending'"
        class="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 px-3 py-2 text-sm"
      >
        <span class="flex items-center gap-2 text-warning">
          <UIcon name="i-lucide-clock" class="size-4 shrink-0" />
          Budget revision awaiting manager approval.
        </span>
        <div v-if="canApproveRevision" class="flex gap-2">
          <UButton
            size="xs"
            color="success"
            label="Approve revision"
            @click="approveRevision(true)"
          />
          <UButton
            size="xs"
            variant="outline"
            color="neutral"
            label="Reject"
            @click="approveRevision(false)"
          />
        </div>
      </div>
      <div
        v-else-if="data.project.budgetRevisionStatus === 'approved'"
        class="flex items-center gap-2 rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-sm text-success"
      >
        <UIcon name="i-lucide-shield-check" class="size-4 shrink-0" /> Revised budget approved.
      </div>

      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-default">
              Budget by category — plan vs committed vs actual
            </h3>
            <UButton
              v-if="canEdit"
              size="xs"
              variant="soft"
              icon="i-lucide-plus"
              label="Add line"
              @click="addLine"
            />
          </div>
        </template>
        <div class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="py-1.5 pr-2 text-left font-medium">Category</th>
                <th class="py-1.5 px-2 text-left font-medium">Phase</th>
                <th class="py-1.5 px-2 text-right font-medium">Original</th>
                <th class="py-1.5 px-2 text-right font-medium">Revised</th>
                <th class="py-1.5 px-2 text-right font-medium" title="Vendors + approved requests">
                  Committed
                </th>
                <th class="py-1.5 px-2 text-right font-medium" title="Recorded expenses">Actual</th>
                <th class="py-1.5 px-2 text-right font-medium">Remaining</th>
                <th v-if="canEdit" class="w-8" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="(l, i) in lines" :key="i">
                <td class="py-1.5 pr-2">
                  <USelectMenu
                    v-if="canEdit"
                    v-model="l.category"
                    :items="lineCategoryItems"
                    size="sm"
                    placeholder="e.g. Personnel"
                    class="w-40"
                  />
                  <span v-else class="font-medium text-default">{{ l.category || '—' }}</span>
                </td>
                <td class="py-1.5 px-2">
                  <UInput
                    v-if="canEdit"
                    v-model="l.phase"
                    size="sm"
                    placeholder="Phase 1"
                    class="w-28"
                  />
                  <span v-else class="text-muted">{{ l.phase || '—' }}</span>
                </td>
                <td class="py-1.5 px-2 text-right">
                  <div v-if="canEdit" class="flex justify-end">
                    <UInputNumber v-model="l.originalAmount" :min="0" size="sm" class="w-28" />
                  </div>
                  <span v-else class="text-default">{{ money(l.originalAmount ?? 0) }}</span>
                </td>
                <td class="py-1.5 px-2 text-right">
                  <div v-if="canEdit" class="flex justify-end">
                    <UInputNumber
                      v-model="l.revisedAmount as number"
                      :min="0"
                      size="sm"
                      class="w-28"
                    />
                  </div>
                  <span v-else class="text-default">{{
                    l.revisedAmount != null ? money(l.revisedAmount) : '—'
                  }}</span>
                </td>
                <td class="py-1.5 px-2 text-right text-muted">
                  {{ money(committedByLine[l.category] ?? 0) }}
                </td>
                <td class="py-1.5 px-2 text-right text-muted">
                  {{ money(spentByLine[l.category] ?? 0) }}
                </td>
                <td
                  class="py-1.5 px-2 text-right font-medium"
                  :class="lineRemaining(l) < 0 ? 'text-error' : 'text-default'"
                >
                  {{ money(lineRemaining(l)) }}
                </td>
                <td v-if="canEdit" class="text-right">
                  <UButton
                    size="xs"
                    variant="ghost"
                    color="error"
                    icon="i-lucide-x"
                    aria-label="Remove"
                    @click="lines.splice(i, 1)"
                  />
                </td>
              </tr>
              <tr v-if="!lines.length">
                <td :colspan="canEdit ? 8 : 7" class="py-3 text-center text-muted">
                  No budget lines yet.
                </td>
              </tr>
            </tbody>
            <tfoot v-if="lines.length" class="border-t-2 border-default">
              <tr class="text-sm font-semibold text-default">
                <td class="py-2 pr-2">Total</td>
                <td />
                <td class="px-2 py-2 text-right">{{ money(budgetTotals.original) }}</td>
                <td class="px-2 py-2 text-right">{{ money(budgetTotals.revised) }}</td>
                <td class="px-2 py-2 text-right">{{ money(budgetTotals.committed) }}</td>
                <td class="px-2 py-2 text-right">{{ money(budgetTotals.actual) }}</td>
                <td
                  class="px-2 py-2 text-right"
                  :class="budgetTotals.remaining < 0 ? 'text-error' : ''"
                >
                  {{ money(budgetTotals.remaining) }}
                </td>
                <td v-if="canEdit" />
              </tr>
            </tfoot>
          </table>
        </div>
        <div v-if="canEdit" class="mt-3 flex justify-end">
          <UButton size="sm" label="Save budget" :loading="busy" @click="saveBudget" />
        </div>
      </UCard>

      <!-- P9 — Expenses: the request → approve → return flow AND the actual
           ledger, in one place. Returned requests become recorded expenses. -->
      <UCard>
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h3 class="text-sm font-semibold text-default">
              Expense requests &amp; returns · {{ money(budgetTotals.actual) }}
            </h3>
            <div v-if="!closed" class="flex gap-2">
              <UButton
                size="xs"
                variant="soft"
                icon="i-lucide-hand-coins"
                label="Request funds"
                @click="openRequest()"
              />
              <UButton
                v-if="canRecordExpense"
                size="xs"
                variant="outline"
                icon="i-lucide-plus"
                label="Record expense"
                @click="openExpense()"
              />
            </div>
          </div>
        </template>

        <!-- Requests in flight (approved = committed; returned ones move below) -->
        <div v-if="pendingRequests.length" class="mb-4">
          <p class="mb-1 text-xs font-medium uppercase tracking-wide text-muted">
            Requests &amp; returns
          </p>
          <ul class="divide-y divide-default">
            <li v-for="r in pendingRequests" :key="r.id" class="py-2.5">
              <div class="flex flex-wrap items-start justify-between gap-2">
                <div class="min-w-0">
                  <p class="text-sm font-medium text-default">{{ r.purpose }}</p>
                  <p class="text-xs text-muted">
                    {{ r.requesterName || 'Someone' }} · requested {{ money(r.amount) }}
                    <span v-if="r.category"> · {{ r.category }}</span>
                  </p>
                  <p v-if="r.decisionNote" class="text-xs text-muted">Note: {{ r.decisionNote }}</p>
                </div>
                <div class="flex shrink-0 items-center gap-1.5">
                  <UBadge
                    :color="EXPENSE_REQUEST_STATUS_COLOR[r.status]"
                    variant="subtle"
                    size="xs"
                    :label="EXPENSE_REQUEST_STATUS_LABEL[r.status]"
                  />
                  <UButton
                    v-if="
                      r.status === 'requested' &&
                      (canApproveExpense || r.requestedByUserId === myId)
                    "
                    size="xs"
                    variant="ghost"
                    color="neutral"
                    icon="i-lucide-pencil"
                    aria-label="Edit request"
                    @click="openRequest(r)"
                  />
                  <template v-if="r.status === 'requested' && canApproveExpense">
                    <UButton
                      size="xs"
                      color="success"
                      variant="soft"
                      label="Approve"
                      @click="decideRequest(r, true)"
                    />
                    <UButton
                      size="xs"
                      color="neutral"
                      variant="outline"
                      label="Reject"
                      @click="decideRequest(r, false)"
                    />
                  </template>
                  <UButton
                    v-if="canReturn(r)"
                    size="xs"
                    variant="soft"
                    icon="i-lucide-receipt"
                    label="Return"
                    @click="openReturn(r)"
                  />
                </div>
              </div>
            </li>
          </ul>
        </div>

        <!-- Actual ledger (direct expenses + returned requests) -->
        <p class="mb-1 text-xs font-medium uppercase tracking-wide text-muted">Recorded expenses</p>
        <ul v-if="data.expenses.length" class="divide-y divide-default">
          <li
            v-for="e in data.expenses"
            :key="e.id"
            class="flex items-center justify-between gap-2 py-2 text-sm"
          >
            <div class="min-w-0">
              <p class="truncate text-default">{{ e.description || e.category || 'Expense' }}</p>
              <p class="text-xs text-muted">
                {{ fdate(e.expenseDate) }}<span v-if="e.category"> · {{ e.category }}</span>
              </p>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="font-medium text-default">{{ money(e.amount) }}</span>
              <UButton
                v-if="canRecordExpense"
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-pencil"
                aria-label="Edit"
                @click="openExpense(e)"
              />
              <UButton
                v-if="canRecordExpense"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                aria-label="Delete"
                @click="call('DELETE', `/expenses/${e.id}`)"
              />
            </div>
          </li>
        </ul>
        <p v-else class="text-sm text-muted">No expenses recorded yet.</p>
      </UCard>

      <div class="grid grid-cols-1 gap-4">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Vendors</h3>
              <UButton
                v-if="canEdit"
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add"
                @click="openVendor()"
              />
            </div>
          </template>
          <ul v-if="data.vendors.length" class="divide-y divide-default">
            <li
              v-for="v in data.vendors"
              :key="v.id"
              class="flex items-center justify-between gap-2 py-2 text-sm"
            >
              <div class="min-w-0">
                <p class="truncate text-default">{{ v.name }}</p>
                <p class="truncate text-xs text-muted">{{ v.scope || v.contactName || '—' }}</p>
                <UBadge
                  v-if="v.budgetCategory"
                  class="mt-0.5"
                  variant="subtle"
                  color="neutral"
                  size="xs"
                  :label="`Budget: ${v.budgetCategory}`"
                />
              </div>
              <div class="flex items-center gap-1.5">
                <span class="text-muted">{{
                  v.contractAmount ? money(v.contractAmount) : '—'
                }}</span>
                <UButton
                  v-if="canEdit"
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-pencil"
                  aria-label="Edit"
                  @click="openVendor(v)"
                />
                <UButton
                  v-if="canEdit"
                  size="xs"
                  variant="ghost"
                  color="error"
                  icon="i-lucide-x"
                  aria-label="Delete"
                  @click="call('DELETE', `/vendors/${v.id}`)"
                />
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">No vendors yet.</p>
        </UCard>
      </div>
    </div>

    <!-- TEAM (PJ-01/02) -->
    <div v-show="tab === 'team'" class="space-y-4">
      <UCard>
        <template #header><h3 class="text-sm font-semibold text-default">Ownership</h3></template>
        <div v-if="canManageTeam" class="flex flex-wrap items-end gap-3">
          <UFormField label="Project Manager" class="min-w-56">
            <USelect
              v-model="pmId"
              :items="userItems"
              value-key="value"
              placeholder="Assign a PM"
              class="w-full"
            />
          </UFormField>
          <UButton size="sm" label="Save" :loading="busy" @click="saveHeader" />
          <p class="w-full text-xs text-muted">
            Project status is computed from milestone progress — it isn't set by hand.
          </p>
        </div>
        <!-- Clean read view: plain values, no disabled inputs. -->
        <div v-else class="flex flex-wrap gap-8 text-sm">
          <div>
            <p class="text-xs uppercase tracking-wide text-muted">Project Manager</p>
            <p class="mt-0.5 font-medium text-default">{{ userName(pmId ?? null) }}</p>
          </div>
          <div>
            <p class="text-xs uppercase tracking-wide text-muted">Status</p>
            <UBadge
              class="mt-0.5"
              :color="closed ? 'neutral' : catColor(data.project.lifecycleCategory)"
              variant="subtle"
              size="sm"
              :label="closed ? 'Closed' : lifeLabel(data.project.lifecycleCategory)"
            />
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header><h3 class="text-sm font-semibold text-default">Team roster</h3></template>
        <ul class="space-y-2">
          <li
            v-for="(m, i) in team"
            :key="m.userId"
            class="flex flex-wrap items-center gap-2 rounded-lg border border-default p-2"
          >
            <span class="min-w-40 flex-1 text-sm font-medium text-default">{{
              userName(m.userId)
            }}</span>
            <UInput
              v-if="canManageTeam"
              v-model="m.role"
              size="sm"
              placeholder="Role"
              class="w-48"
            />
            <span v-else class="w-48 text-sm text-muted">{{ m.role || 'Member' }}</span>
            <UButton
              v-if="canManageTeam"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Remove"
              class="ml-auto"
              @click="team.splice(i, 1)"
            />
          </li>
          <li v-if="!team.length" class="text-sm text-muted">No team members yet.</li>
        </ul>
        <div v-if="canManageTeam" class="mt-3 flex flex-wrap items-center gap-2">
          <USelect
            v-model="addMemberId"
            :items="userItems"
            value-key="value"
            placeholder="Add member…"
            class="w-56"
          />
          <USelect
            v-model="addMemberRole"
            :items="teamRoleItems"
            value-key="value"
            placeholder="Role"
            class="w-44"
          />
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-user-plus"
            label="Add"
            @click="addMember"
          />
          <UButton size="sm" label="Save team" class="ml-auto" :loading="busy" @click="saveTeam" />
        </div>
      </UCard>
    </div>

    <!-- REPORTS (PJ-09) + timesheet (PJ-06) -->
    <div v-show="tab === 'reports'" class="space-y-4">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UCard class="lg:col-span-2">
          <template #header>
            <div class="flex flex-wrap items-center justify-between gap-2">
              <h3 class="text-sm font-semibold text-default">Reports</h3>
              <div v-if="!closed" class="flex gap-2">
                <UButton
                  v-if="canEdit"
                  size="xs"
                  variant="outline"
                  icon="i-lucide-plus"
                  label="My activity report"
                  :loading="creatingReport"
                  @click="newReport('activity')"
                />
                <UButton
                  v-if="isProjectLead"
                  size="xs"
                  variant="soft"
                  icon="i-lucide-plus"
                  label="General report"
                  :loading="creatingReport"
                  @click="newReport('general')"
                />
              </div>
            </div>
          </template>
          <p class="mb-2 text-xs text-muted">
            You see your own reports;<template v-if="isProjectLead">
              as lead you see everyone's.</template
            ><template v-else> the general report appears when it's shared.</template>
          </p>
          <ul v-if="data.reports.length" class="divide-y divide-default">
            <li
              v-for="r in data.reports"
              :key="r.id"
              class="flex cursor-pointer flex-wrap items-center justify-between gap-2 py-2 transition-colors hover:bg-elevated/40"
              @click="navigateTo(`/projects/${id}/reports/${r.id}`)"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">
                  {{ r.title }}
                  <UBadge
                    v-if="r.kind === 'general'"
                    color="primary"
                    variant="subtle"
                    size="xs"
                    label="General"
                    class="ml-1"
                  />
                </p>
                <p class="text-xs text-muted">
                  {{ [r.authorFirstName, r.authorLastName].filter(Boolean).join(' ') || '—' }} ·
                  {{ fdate(r.updatedAt) }}
                </p>
              </div>
              <div class="flex items-center gap-1">
                <UBadge
                  :color="PROJECT_REPORT_STATUS_COLOR[r.status]"
                  variant="subtle"
                  size="xs"
                  :label="reportStatusLabel(r.status, r.kind)"
                />
                <UIcon name="i-lucide-chevron-right" class="size-4 text-muted" />
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">No reports yet.</p>
        </UCard>

        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Logged hours</h3></template
          >
          <ul v-if="data.timesheetByUser.length" class="space-y-1.5 text-sm">
            <li v-for="t in data.timesheetByUser" :key="t.userId" class="flex justify-between">
              <span class="truncate text-default">{{ t.name }}</span
              ><span class="text-muted">{{ t.hours }}h</span>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">No time logged yet.</p>
        </UCard>
      </div>
    </div>

    <!-- M&E (S16) -->
    <div v-if="canMel" v-show="tab === 'mel'">
      <ProjectMel
        :project-id="id"
        :can-edit="can('mel', 'update') && !closed"
        :portal-token="data.project.portalToken"
        @portal-changed="refresh"
      />
    </div>

    <!-- Modals -->
    <UModal v-model:open="msOpen" :title="msForm.id ? 'Edit milestone' : 'Add milestone'">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required
            ><UInput v-model="msForm.name" autofocus class="w-full"
          /></UFormField>
          <UFormField label="Due date"
            ><UInput v-model="msForm.dueDate" type="date" class="w-full"
          /></UFormField>
          <UFormField label="Completion criteria"
            ><UTextarea v-model="msForm.completionCriteria" :rows="2" class="w-full"
          /></UFormField>
          <p class="text-xs text-muted">
            Milestone status is set automatically from its activities.
          </p>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="msOpen = false" /><UButton
            :label="msForm.id ? 'Save' : 'Add'"
            :loading="busy"
            @click="saveMilestone"
          /></div
      ></template>
    </UModal>

    <UModal v-model:open="actOpen" title="Add activity">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required><UInput v-model="actForm.name" autofocus /></UFormField>
          <UFormField label="Milestone"
            ><USelect
              v-model="actForm.milestoneId"
              :items="milestoneItems"
              value-key="value"
              class="w-full"
          /></UFormField>
          <UFormField label="Assignee"
            ><USelect
              v-model="actForm.assignedUserId"
              :items="[{ label: 'Unassigned', value: NONE_OPT }, ...userItems]"
              value-key="value"
              class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Start"
              ><UInput v-model="actForm.startDate" type="date"
            /></UFormField>
            <UFormField label="End"><UInput v-model="actForm.endDate" type="date" /></UFormField>
          </div>
          <UFormField label="Planned hours"
            ><UInputNumber v-model="actForm.plannedHours" :min="0" class="w-full"
          /></UFormField>
          <UFormField label="Depends on" hint="This activity starts after the one you pick">
            <USelect
              v-model="actForm.dependsOnActivityId"
              :items="activityItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="actOpen = false"
          /><UButton label="Add" :loading="busy" @click="addActivity" /></div
      ></template>
    </UModal>

    <UModal v-model:open="expOpen" :title="expForm.id ? 'Edit expense' : 'Record expense'">
      <template #body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Amount" required
              ><UInputNumber v-model="expForm.amount" :min="0" class="w-full"
            /></UFormField>
            <UFormField label="Date"
              ><UInput v-model="expForm.expenseDate" type="date" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Budget category" hint="Rolls up under this budget line's Actual">
            <USelect
              v-model="expForm.category"
              :items="[
                { label: 'Uncategorised', value: NONE_OPT },
                ...lineCategoryItems.map((c) => ({ label: c, value: c })),
              ]"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Description"
            ><UInput v-model="expForm.description" class="w-full"
          /></UFormField>
          <UFormField label="Receipt URL"
            ><UInput v-model="expForm.receiptUrl" placeholder="https://…" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="expOpen = false"
          /><UButton
            :label="expForm.id ? 'Save' : 'Record'"
            :loading="busy"
            @click="saveExpense"
          /></div
      ></template>
    </UModal>

    <UModal v-model:open="reqOpen" :title="reqForm.id ? 'Edit request' : 'Request funds'">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Purpose" required>
            <UInput
              v-model="reqForm.purpose"
              autofocus
              class="w-full"
              placeholder="e.g. Annual hosting renewal"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Amount" required>
              <UInputNumber v-model="reqForm.amount" :min="0" class="w-full" />
            </UFormField>
            <UFormField label="Budget category">
              <USelect
                v-model="reqForm.category"
                :items="[
                  { label: 'None', value: NONE_OPT },
                  ...lineCategoryItems.map((c) => ({ label: c, value: c })),
                ]"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>
          <p class="text-xs text-muted">
            Once approved and paid, you’ll return it with the receipt to reconcile the budget.
          </p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="reqOpen = false" />
          <UButton
            :label="reqForm.id ? 'Save' : 'Submit request'"
            :loading="busy"
            @click="submitRequest"
          />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="retOpen" title="Return expense">
      <template #body>
        <div class="space-y-3">
          <p v-if="retTarget" class="text-sm text-muted">
            {{ retTarget.purpose }} — approved for {{ money(retTarget.amount) }}.
          </p>
          <UFormField label="Amount actually spent" required>
            <UInputNumber v-model="retForm.spentAmount" :min="0" class="w-full" />
          </UFormField>
          <UFormField label="Receipt / proof of payment (URL)" required>
            <UInput v-model="retForm.receiptUrl" class="w-full" placeholder="https://…" />
          </UFormField>
          <UFormField label="Note">
            <UTextarea v-model="retForm.returnNote" :rows="2" class="w-full" />
          </UFormField>
          <p class="text-xs text-muted">This posts the actual spend to the project budget.</p>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="retOpen = false" />
          <UButton label="Submit return" :loading="busy" @click="submitReturn" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="venOpen" :title="venForm.id ? 'Edit vendor' : 'Add vendor'">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required
            ><UInput v-model="venForm.name" autofocus class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Contact"><UInput v-model="venForm.contactName" /></UFormField>
            <UFormField label="Email"><UInput v-model="venForm.contactEmail" /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Contract amount"
              ><UInputNumber v-model="venForm.contractAmount" :min="0" class="w-full"
            /></UFormField>
            <UFormField label="Currency"
              ><UInput v-model="venForm.currency" maxlength="3"
            /></UFormField>
          </div>
          <UFormField label="Scope / deliverables"
            ><UTextarea v-model="venForm.scope" :rows="2" class="w-full"
          /></UFormField>
          <UFormField label="Payment schedule"
            ><UInput
              v-model="venForm.paymentSchedule"
              placeholder="e.g. 50% on signing, 50% on delivery"
          /></UFormField>
          <UFormField label="Budget line" hint="Roll this vendor's spend under a budget category">
            <USelect
              v-model="venForm.budgetCategory"
              :items="budgetCategoryItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="venOpen = false"
          /><UButton
            :label="venForm.id ? 'Save' : 'Add'"
            :loading="busy"
            @click="saveVendor"
          /></div
      ></template>
    </UModal>

    <UModal v-model:open="tsOpen" title="Log time">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Activity"
            ><USelect
              v-model="tsForm.activityId"
              :items="[
                { label: 'General', value: NONE_OPT },
                ...data.activities.map((a) => ({ label: a.name, value: a.id })),
              ]"
              value-key="value"
              class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Date"><UInput v-model="tsForm.entryDate" type="date" /></UFormField>
            <UFormField label="Hours" required
              ><UInputNumber v-model="tsForm.hours" :min="0" :max="24" :step="0.5" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Note"><UInput v-model="tsForm.note" /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="tsOpen = false" /><UButton
            label="Log"
            :loading="busy"
            @click="logTime"
          /></div
      ></template>
    </UModal>

    <UModal v-model:open="editOpen" title="Edit project">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required>
            <UInput v-model="editForm.name" autofocus class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Code"><UInput v-model="editForm.code" class="w-full" /></UFormField>
            <UFormField label="Currency"
              ><UInput v-model="editForm.currency" maxlength="3" class="w-full"
            /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Start"
              ><UInput v-model="editForm.startDate" type="date" class="w-full"
            /></UFormField>
            <UFormField label="End"
              ><UInput v-model="editForm.endDate" type="date" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Total budget">
            <UInputNumber v-model="editForm.totalBudget" :min="0" class="w-full" />
          </UFormField>
          <UFormField label="Client / donor" hint="Who this engagement is delivered for">
            <USelect
              v-model="editForm.clientId"
              :items="clientItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Linked proposal" hint="The won proposal this project delivers">
            <USelect
              v-model="editForm.proposalId"
              :items="proposalItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="editForm.description" :rows="2" class="w-full" />
          </UFormField>
          <UFormField label="Scope">
            <UTextarea v-model="editForm.scope" :rows="2" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="editOpen = false" />
          <UButton label="Save changes" :loading="busy" @click="saveEdit" />
        </div>
      </template>
    </UModal>

    <UModal v-model:open="closeOpen" title="Close project">
      <template #body>
        <div class="space-y-2">
          <p class="text-sm text-muted">
            Complete the sign-off checklist to close and archive this project.
          </p>
          <label
            v-for="item in projectSettings.closeChecklist"
            :key="item"
            class="flex items-center gap-2 rounded-lg border border-default p-2 text-sm"
          >
            <UCheckbox v-model="checklist[item]" /> {{ item }}
          </label>
          <UFormField label="Reason for closing" required class="pt-1">
            <UTextarea
              v-model="closeReason"
              :rows="2"
              class="w-full"
              placeholder="e.g. All deliverables accepted and signed off by the client."
            />
          </UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="closeOpen = false"
          /><UButton
            color="success"
            label="Close &amp; archive"
            :loading="closing"
            @click="closeProject"
          /></div
      ></template>
    </UModal>
  </div>
</template>
