<script setup lang="ts">
import {
  ACTIVITY_STATUS_COLOR,
  ACTIVITY_STATUS_LABEL,
  ACTIVITY_STATUSES,
  CLOSE_CHECKLIST_ITEMS,
  MILESTONE_STATUS_COLOR,
  MILESTONE_STATUS_LABEL,
  MILESTONE_STATUSES,
  PROJECT_REPORT_STATUS_COLOR,
  PROJECT_REPORT_STATUS_LABEL,
  PROJECT_STATUS_COLOR,
  PROJECT_STATUS_LABEL,
  PROJECT_STATUSES,
  type ActivityStatus,
  type MilestoneStatus,
  type ProjectStatus,
} from '@@/shared/schemas/project'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const toast = useToast()

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
  status: MilestoneStatus
  orderIndex: number
  completedAt: string | null
}
interface Activity {
  id: string
  milestoneId: string | null
  name: string
  assignedUserId: string | null
  assigneeFirstName: string | null
  assigneeLastName: string | null
  startDate: string | null
  endDate: string | null
  plannedHours: string | null
  percentComplete: number
  status: ActivityStatus
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
}
interface ReportRow {
  id: string
  title: string
  status: 'draft' | 'in_review' | 'approved'
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
  status: ProjectStatus
  startDate: string | null
  endDate: string | null
  totalBudget: string | null
  currency: string
  clientId: string | null
  clientName: string | null
  proposalId: string | null
  projectManagerUserId: string | null
  pmFirstName: string | null
  pmLastName: string | null
  closedAt: string | null
  closeChecklist: Record<string, boolean> | null
  portalToken: string | null
}
interface Summary {
  budgetTotal: number
  spent: number
  burnRate: number
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
  budgetLines: BudgetLine[]
  expenses: Expense[]
  vendors: Vendor[]
  reports: ReportRow[]
  timesheetByUser: { userId: string; name: string; hours: number }[]
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
const userName = (uid: string | null) => {
  if (!uid) return 'Unassigned'
  const u = usersData.value?.users.find((x) => x.id === uid)
  return u ? [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email : 'User'
}

const closed = computed(() => !!data.value?.project.closedAt)
const canEdit = computed(() => can.value('project', 'update') && !closed.value)
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
const tab = ref<TabKey>('overview')
const tabs = computed<{ key: TabKey; label: string; icon: string }[]>(() => [
  { key: 'overview', label: 'Overview', icon: 'i-lucide-gauge' },
  { key: 'plan', label: 'Plan', icon: 'i-lucide-list-checks' },
  { key: 'budget', label: 'Budget', icon: 'i-lucide-wallet' },
  { key: 'team', label: 'Team', icon: 'i-lucide-users' },
  { key: 'reports', label: 'Reports', icon: 'i-lucide-file-text' },
  ...(canMel.value ? [{ key: 'mel' as TabKey, label: 'M&E', icon: 'i-lucide-line-chart' }] : []),
])

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

async function call(method: string, path: string, body?: Record<string, unknown>, ok?: string) {
  try {
    await $fetch(`/api/projects/${id}${path}` as string, { method: method as 'POST', body })
    if (ok) toast.add({ title: ok, color: 'success' })
    await refresh()
    return true
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Action failed', description: msg, color: 'error' })
    return false
  }
}

// ── PM + status ──
const pmId = ref<string | undefined>(undefined)
const projStatus = ref<ProjectStatus>('planning')
watchEffect(() => {
  pmId.value = data.value?.project.projectManagerUserId ?? undefined
  projStatus.value = data.value?.project.status ?? 'planning'
})
const statusItems = PROJECT_STATUSES.map((s) => ({
  label: PROJECT_STATUS_LABEL[s],
  value: s as string,
}))
async function saveHeader() {
  await call(
    'PATCH',
    '',
    { projectManagerUserId: pmId.value ?? null, status: projStatus.value },
    'Project updated'
  )
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
function addMember() {
  if (!addMemberId.value || team.value.some((t) => t.userId === addMemberId.value)) return
  team.value.push({ userId: addMemberId.value, role: 'Team Member', allocationPct: 100 })
  addMemberId.value = undefined
}
async function saveTeam() {
  await call('PUT', '/members', { members: team.value }, 'Team saved')
}

// ── Milestones (PJ-03) ──
const msOpen = ref(false)
const msForm = reactive({ name: '', dueDate: '', completionCriteria: '' })
async function addMilestone() {
  if (!msForm.name.trim()) return
  if (
    await call('POST', '/milestones', {
      name: msForm.name,
      dueDate: msForm.dueDate || null,
      completionCriteria: msForm.completionCriteria || null,
    })
  ) {
    msOpen.value = false
    msForm.name = ''
    msForm.dueDate = ''
    msForm.completionCriteria = ''
  }
}
const msStatusItems = MILESTONE_STATUSES.map((s) => ({
  label: MILESTONE_STATUS_LABEL[s],
  value: s as string,
}))
async function setMilestoneStatus(m: Milestone, status: string) {
  await call('PATCH', `/milestones/${m.id}`, { status })
}

// ── Activities (PJ-04) ──
const actOpen = ref(false)
const actForm = reactive({
  name: '',
  milestoneId: '',
  assignedUserId: '',
  startDate: '',
  endDate: '',
  plannedHours: null as number | null,
})
async function addActivity() {
  if (!actForm.name.trim()) return
  if (
    await call('POST', '/activities', {
      name: actForm.name,
      milestoneId: actForm.milestoneId || null,
      assignedUserId: actForm.assignedUserId || null,
      startDate: actForm.startDate || null,
      endDate: actForm.endDate || null,
      plannedHours: actForm.plannedHours,
    })
  ) {
    actOpen.value = false
    actForm.name = ''
    actForm.milestoneId = ''
    actForm.assignedUserId = ''
    actForm.startDate = ''
    actForm.endDate = ''
    actForm.plannedHours = null
  }
}
const actStatusItems = ACTIVITY_STATUSES.map((s) => ({
  label: ACTIVITY_STATUS_LABEL[s],
  value: s as string,
}))
async function updateActivity(a: Activity, patch: Record<string, unknown>) {
  await call('PATCH', `/activities/${a.id}`, patch)
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
const spentByLine = computed(() => {
  const m: Record<string, number> = {}
  for (const e of data.value?.expenses ?? [])
    m[e.category ?? ''] = (m[e.category ?? ''] ?? 0) + Number(e.amount)
  return m
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

// ── Expenses (PJ-07) ──
const expOpen = ref(false)
const expForm = reactive({
  amount: null as number | null,
  category: '',
  expenseDate: new Date().toISOString().slice(0, 10),
  description: '',
  receiptUrl: '',
})
async function addExpense() {
  if (expForm.amount == null) return
  if (
    await call('POST', '/expenses', {
      amount: expForm.amount,
      category: expForm.category || null,
      expenseDate: expForm.expenseDate,
      description: expForm.description || null,
      receiptUrl: expForm.receiptUrl || '',
    })
  ) {
    expOpen.value = false
    expForm.amount = null
    expForm.category = ''
    expForm.description = ''
    expForm.receiptUrl = ''
  }
}

// ── Vendors (PJ-08) ──
const venOpen = ref(false)
const venForm = reactive({
  name: '',
  contactName: '',
  contactEmail: '',
  contractAmount: null as number | null,
  currency: 'USD',
  scope: '',
  paymentSchedule: '',
})
async function addVendor() {
  if (!venForm.name.trim()) return
  if (
    await call('POST', '/vendors', {
      name: venForm.name,
      contactName: venForm.contactName || null,
      contactEmail: venForm.contactEmail || '',
      contractAmount: venForm.contractAmount,
      currency: venForm.currency || 'USD',
      scope: venForm.scope || null,
      paymentSchedule: venForm.paymentSchedule || null,
    })
  ) {
    venOpen.value = false
    venForm.name = ''
    venForm.contactName = ''
    venForm.contactEmail = ''
    venForm.contractAmount = null
    venForm.scope = ''
    venForm.paymentSchedule = ''
  }
}

// ── Reports (PJ-09) ──
const REPORT_TEMPLATE =
  '## Summary\n\n## Progress this period\n\n## Issues & risks\n\n## Next steps\n'
const repOpen = ref(false)
const repForm = reactive({ title: '', content: REPORT_TEMPLATE })
async function addReport() {
  if (!repForm.title.trim()) return
  if (await call('POST', '/reports', { title: repForm.title, content: repForm.content })) {
    repOpen.value = false
    repForm.title = ''
    repForm.content = REPORT_TEMPLATE
  }
}
async function setReportStatus(r: ReportRow, status: string) {
  await call('PATCH', `/reports/${r.id}`, { status })
}

// ── Timesheet (PJ-06) ──
const tsOpen = ref(false)
const tsForm = reactive({
  activityId: '',
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
        activityId: tsForm.activityId || null,
        entryDate: tsForm.entryDate,
        hours: tsForm.hours,
        note: tsForm.note || null,
      },
      'Time logged'
    )
  ) {
    tsOpen.value = false
    tsForm.hours = null
    tsForm.note = ''
  }
}

// ── Close (PJ-11) ──
const closeOpen = ref(false)
const checklist = reactive<Record<string, boolean>>(
  Object.fromEntries(CLOSE_CHECKLIST_ITEMS.map((i) => [i, false]))
)
const closing = ref(false)
async function closeProject() {
  closing.value = true
  if (await call('POST', '/close', { checklist: { ...checklist } }, 'Project closed'))
    closeOpen.value = false
  closing.value = false
}

const milestoneItems = computed(() => [
  { label: 'No milestone', value: '' },
  ...(data.value?.milestones ?? []).map((m) => ({ label: m.name, value: m.id })),
])
</script>

<template>
  <div v-if="data" class="space-y-5">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-3">
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
          <UBadge
            :color="PROJECT_STATUS_COLOR[data.project.status]"
            variant="subtle"
            :label="PROJECT_STATUS_LABEL[data.project.status]"
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
      <UButton
        v-if="can('project', 'update') && !closed"
        icon="i-lucide-flag"
        color="neutral"
        variant="outline"
        label="Close project"
        @click="closeOpen = true"
      />
    </div>

    <div
      v-if="closed"
      class="rounded-lg border border-success/40 bg-success/5 px-3 py-2 text-sm text-success"
    >
      <UIcon name="i-lucide-check-circle" class="inline size-4" /> Closed
      {{ fdate(data.project.closedAt) }} — archived &amp; read-only.
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
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Schedule</p>
          <p class="mt-1 text-2xl font-semibold" :class="ragClass(scheduleRag)">
            {{ data.summary.milestonesDone }}/{{ data.summary.milestonesTotal }}
          </p>
          <p class="text-xs text-muted">{{ data.summary.overdueMilestones }} overdue</p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Budget burn</p>
          <p class="mt-1 text-2xl font-semibold" :class="ragClass(budgetRag)">
            {{ data.summary.burnRate }}%
          </p>
          <p class="text-xs text-muted">
            {{ money(data.summary.spent) }} / {{ money(data.summary.budgetTotal) }}
          </p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Delivery</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ data.summary.activitiesDone }}/{{ data.summary.activitiesTotal }}
          </p>
          <p class="text-xs text-muted">activities done</p>
        </div>
        <div class="rounded-xl border border-default p-4">
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

    <!-- PLAN (PJ-03/04) -->
    <div v-show="tab === 'plan'" class="space-y-4">
      <div class="flex justify-end gap-2">
        <UButton
          v-if="canEdit"
          size="sm"
          variant="outline"
          icon="i-lucide-flag"
          label="Add milestone"
          @click="msOpen = true"
        />
        <UButton
          v-if="canEdit"
          size="sm"
          icon="i-lucide-plus"
          label="Add activity"
          @click="actOpen = true"
        />
      </div>

      <UCard v-for="m in data.milestones" :key="m.id">
        <template #header>
          <div class="flex flex-wrap items-center justify-between gap-2">
            <div class="flex items-center gap-2">
              <h3 class="text-sm font-semibold text-default">{{ m.name }}</h3>
              <UBadge
                :color="MILESTONE_STATUS_COLOR[m.status]"
                variant="subtle"
                size="xs"
                :label="MILESTONE_STATUS_LABEL[m.status]"
              />
              <span v-if="m.dueDate" class="text-xs text-muted">due {{ fdate(m.dueDate) }}</span>
            </div>
            <div class="flex items-center gap-1">
              <USelect
                v-if="canEdit"
                :model-value="m.status"
                :items="msStatusItems"
                value-key="value"
                size="xs"
                class="w-36"
                @update:model-value="(v) => setMilestoneStatus(m, v as string)"
              />
              <UButton
                v-if="canEdit"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                aria-label="Delete"
                @click="call('DELETE', `/milestones/${m.id}`)"
              />
            </div>
          </div>
        </template>
        <ul class="divide-y divide-default">
          <li
            v-for="a in data.activities.filter((x) => x.milestoneId === m.id)"
            :key="a.id"
            class="flex flex-wrap items-center justify-between gap-2 py-2"
          >
            <div class="min-w-0">
              <p class="text-sm font-medium text-default">{{ a.name }}</p>
              <p class="text-xs text-muted">
                {{ userName(a.assignedUserId) }} · {{ fdate(a.startDate) }}–{{ fdate(a.endDate) }}
              </p>
            </div>
            <div class="flex items-center gap-2">
              <div class="h-1.5 w-20 overflow-hidden rounded-full bg-elevated">
                <div class="h-full bg-primary" :style="{ width: `${a.percentComplete}%` }" />
              </div>
              <USelect
                v-if="canEdit"
                :model-value="a.status"
                :items="actStatusItems"
                value-key="value"
                size="xs"
                class="w-32"
                @update:model-value="(v) => updateActivity(a, { status: v })"
              />
              <UBadge
                v-else
                :color="ACTIVITY_STATUS_COLOR[a.status]"
                variant="subtle"
                size="xs"
                :label="ACTIVITY_STATUS_LABEL[a.status]"
              />
              <UButton
                v-if="canEdit"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                aria-label="Delete"
                @click="call('DELETE', `/activities/${a.id}`)"
              />
            </div>
          </li>
          <li
            v-if="!data.activities.some((x) => x.milestoneId === m.id)"
            class="py-2 text-xs text-muted"
          >
            No activities yet.
          </li>
        </ul>
      </UCard>

      <UCard v-if="data.activities.some((a) => !a.milestoneId)">
        <template #header
          ><h3 class="text-sm font-semibold text-default">Unscheduled activities</h3></template
        >
        <ul class="divide-y divide-default">
          <li
            v-for="a in data.activities.filter((x) => !x.milestoneId)"
            :key="a.id"
            class="flex items-center justify-between gap-2 py-2"
          >
            <p class="text-sm text-default">{{ a.name }}</p>
            <UBadge
              :color="ACTIVITY_STATUS_COLOR[a.status]"
              variant="subtle"
              size="xs"
              :label="ACTIVITY_STATUS_LABEL[a.status]"
            />
          </li>
        </ul>
      </UCard>

      <p
        v-if="!data.milestones.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No milestones yet.
      </p>
    </div>

    <!-- BUDGET (PJ-05/07/08) -->
    <div v-show="tab === 'budget'" class="space-y-4">
      <UCard>
        <template #header>
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-semibold text-default">
              Budget — original vs revised vs actual
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
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="py-1.5 pr-2 font-medium">Category</th>
                <th class="py-1.5 px-2 font-medium">Phase</th>
                <th class="py-1.5 px-2 text-right font-medium">Original</th>
                <th class="py-1.5 px-2 text-right font-medium">Revised</th>
                <th class="py-1.5 px-2 text-right font-medium">Actual</th>
                <th v-if="canEdit" />
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="(l, i) in lines" :key="i">
                <td class="py-1.5 pr-2">
                  <UInput
                    v-model="l.category"
                    size="sm"
                    :disabled="!canEdit"
                    placeholder="e.g. Personnel"
                  />
                </td>
                <td class="py-1.5 px-2">
                  <UInput
                    v-model="l.phase"
                    size="sm"
                    :disabled="!canEdit"
                    placeholder="Phase 1"
                    class="w-28"
                  />
                </td>
                <td class="py-1.5 px-2">
                  <UInputNumber
                    v-model="l.originalAmount"
                    :min="0"
                    size="sm"
                    :disabled="!canEdit"
                    class="w-28"
                  />
                </td>
                <td class="py-1.5 px-2">
                  <UInputNumber
                    v-model="l.revisedAmount as number"
                    :min="0"
                    size="sm"
                    :disabled="!canEdit"
                    class="w-28"
                  />
                </td>
                <td class="py-1.5 px-2 text-right text-muted">
                  {{ money(spentByLine[l.category] ?? 0) }}
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
                <td colspan="6" class="py-3 text-center text-muted">No budget lines yet.</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div v-if="canEdit" class="mt-3 flex justify-end">
          <UButton size="sm" label="Save budget" @click="saveBudget" />
        </div>
      </UCard>

      <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UCard>
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">
                Expenses · {{ money(data.summary.spent) }}
              </h3>
              <UButton
                v-if="canEdit"
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="Add"
                @click="expOpen = true"
              />
            </div>
          </template>
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
              <div class="flex items-center gap-2">
                <span class="font-medium text-default">{{ money(e.amount) }}</span
                ><UButton
                  v-if="canEdit"
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
          <p v-else class="text-sm text-muted">No expenses recorded.</p>
        </UCard>

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
                @click="venOpen = true"
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
              </div>
              <div class="flex items-center gap-2">
                <span class="text-muted">{{
                  v.contractAmount ? money(v.contractAmount) : '—'
                }}</span
                ><UButton
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
        <div class="flex flex-wrap items-end gap-3">
          <UFormField label="Project Manager" class="min-w-56">
            <USelect
              v-model="pmId"
              :items="userItems"
              value-key="value"
              :disabled="!canEdit"
              placeholder="Assign a PM"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Status">
            <USelect
              v-model="projStatus"
              :items="statusItems"
              value-key="value"
              :disabled="!canEdit"
              class="w-44"
            />
          </UFormField>
          <UButton v-if="canEdit" size="sm" label="Save" @click="saveHeader" />
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
              v-model="m.role"
              size="sm"
              :disabled="!canEdit"
              placeholder="Role"
              class="w-40"
            />
            <div class="flex items-center gap-1">
              <UInputNumber
                v-model="m.allocationPct"
                :min="0"
                :max="100"
                size="sm"
                :disabled="!canEdit"
                class="w-24"
              />
              <span class="text-xs text-muted">%</span>
              <UIcon
                v-if="m.allocationPct > 100"
                name="i-lucide-alert-triangle"
                class="size-4 text-warning"
                title="Over-allocated"
              />
            </div>
            <UButton
              v-if="canEdit"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Remove"
              @click="team.splice(i, 1)"
            />
          </li>
          <li v-if="!team.length" class="text-sm text-muted">No team members yet.</li>
        </ul>
        <div v-if="canEdit" class="mt-3 flex flex-wrap items-center gap-2">
          <USelect
            v-model="addMemberId"
            :items="userItems"
            value-key="value"
            placeholder="Add member…"
            class="w-56"
          />
          <UButton
            size="sm"
            variant="soft"
            icon="i-lucide-user-plus"
            label="Add"
            @click="addMember"
          />
          <UButton size="sm" label="Save team" class="ml-auto" @click="saveTeam" />
        </div>
      </UCard>
    </div>

    <!-- REPORTS (PJ-09) + timesheet (PJ-06) -->
    <div v-show="tab === 'reports'" class="space-y-4">
      <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <UCard class="lg:col-span-2">
          <template #header>
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-semibold text-default">Project reports</h3>
              <UButton
                v-if="canEdit"
                size="xs"
                variant="soft"
                icon="i-lucide-plus"
                label="New report"
                @click="repOpen = true"
              />
            </div>
          </template>
          <ul v-if="data.reports.length" class="divide-y divide-default">
            <li
              v-for="r in data.reports"
              :key="r.id"
              class="flex flex-wrap items-center justify-between gap-2 py-2"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium text-default">{{ r.title }}</p>
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
                  :label="PROJECT_REPORT_STATUS_LABEL[r.status]"
                />
                <UButton
                  v-if="canEdit && r.status === 'draft'"
                  size="xs"
                  variant="ghost"
                  label="Submit"
                  @click="setReportStatus(r, 'in_review')"
                />
                <UButton
                  v-if="canEdit && r.status === 'in_review'"
                  size="xs"
                  variant="ghost"
                  color="success"
                  label="Approve"
                  @click="setReportStatus(r, 'approved')"
                />
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
    <UModal v-model:open="msOpen" title="Add milestone">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required><UInput v-model="msForm.name" autofocus /></UFormField>
          <UFormField label="Due date"><UInput v-model="msForm.dueDate" type="date" /></UFormField>
          <UFormField label="Completion criteria"
            ><UTextarea v-model="msForm.completionCriteria" :rows="2" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="msOpen = false" /><UButton
            label="Add"
            @click="addMilestone"
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
              :items="[{ label: 'Unassigned', value: '' }, ...userItems]"
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
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="actOpen = false"
          /><UButton label="Add" @click="addActivity" /></div
      ></template>
    </UModal>

    <UModal v-model:open="expOpen" title="Record expense">
      <template #body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Amount" required
              ><UInputNumber v-model="expForm.amount" :min="0" class="w-full"
            /></UFormField>
            <UFormField label="Date"
              ><UInput v-model="expForm.expenseDate" type="date"
            /></UFormField>
          </div>
          <UFormField label="Category"
            ><UInput v-model="expForm.category" placeholder="Match a budget category"
          /></UFormField>
          <UFormField label="Description"><UInput v-model="expForm.description" /></UFormField>
          <UFormField label="Receipt URL"
            ><UInput v-model="expForm.receiptUrl" placeholder="https://…"
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
          /><UButton label="Record" @click="addExpense" /></div
      ></template>
    </UModal>

    <UModal v-model:open="venOpen" title="Add vendor">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required><UInput v-model="venForm.name" autofocus /></UFormField>
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
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="venOpen = false"
          /><UButton label="Add" @click="addVendor" /></div
      ></template>
    </UModal>

    <UModal v-model:open="repOpen" title="New report">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title" required
            ><UInput
              v-model="repForm.title"
              placeholder="e.g. Monthly Progress Report — June"
              autofocus
          /></UFormField>
          <UFormField label="Content" hint="Template enforces the standard sections."
            ><UTextarea v-model="repForm.content" :rows="8" class="w-full font-mono text-xs"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="repOpen = false"
          /><UButton label="Create draft" @click="addReport" /></div
      ></template>
    </UModal>

    <UModal v-model:open="tsOpen" title="Log time">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Activity"
            ><USelect
              v-model="tsForm.activityId"
              :items="[
                { label: 'General', value: '' },
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
            @click="logTime"
          /></div
      ></template>
    </UModal>

    <UModal v-model:open="closeOpen" title="Close project">
      <template #body>
        <div class="space-y-2">
          <p class="text-sm text-muted">
            Complete the sign-off checklist to close and archive this project.
          </p>
          <label
            v-for="item in CLOSE_CHECKLIST_ITEMS"
            :key="item"
            class="flex items-center gap-2 rounded-lg border border-default p-2 text-sm"
          >
            <UCheckbox v-model="checklist[item]" /> {{ item }}
          </label>
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
