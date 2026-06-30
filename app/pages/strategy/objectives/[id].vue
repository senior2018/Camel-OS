<script setup lang="ts">
import {
  STRATEGY_STATUS_COLOR,
  STRATEGY_STATUS_LABEL,
  STRATEGY_STATUSES,
  checkinSchema,
  goalSchema,
  individualObjectiveSchema,
  kpiSchema,
  type StrategyStatus,
} from '@@/shared/schemas/strategy'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const { can } = await usePermissions()
const canEdit = computed(() => can.value('strategy', 'update'))
const toast = useToast()

interface Kpi {
  id: string
  name: string
  unit: string | null
  baseline: string
  target: string | null
  current: string
  direction: string
  progress: number
  status: StrategyStatus
}
interface Individual {
  id: string
  userId: string
  owner: string
  title: string
  progressPct: number
  status: StrategyStatus
  dueDate: string | null
}
interface Goal {
  id: string
  title: string
  description: string | null
  department: string | null
  owner: string | null
  progressPct: number
  status: StrategyStatus
  dueDate: string | null
  individuals: Individual[]
}
interface Checkin {
  id: string
  summary: string | null
  ragStatus: StrategyStatus
  author: string
  createdAt: string
}
interface Objective {
  id: string
  year: number
  title: string
  description: string | null
  theme: string | null
  owner: string | null
  status: StrategyStatus
  progress: number
  manualStatus: StrategyStatus | null
}
const { data, refresh } = await useFetch<{
  objective: Objective
  kpis: Kpi[]
  goals: Goal[]
  checkins: Checkin[]
}>(`/api/strategy/objectives/${id}`, { key: `objective-${id}` })
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Not found', fatal: true })
useHead(() => ({ title: `${data.value?.objective.title ?? 'Objective'} — Camel OS` }))

const { data: people } = await useFetch<{ items: { id: string; name: string }[] }>(
  '/api/strategy/people',
  { key: 'strategy-people', default: () => ({ items: [] }) }
)
const peopleItems = computed(() => [
  { label: '— Unassigned —', value: '' },
  ...(people.value?.items ?? []).map((p) => ({ label: p.name, value: p.id })),
])
const statusItems = STRATEGY_STATUSES.map((s) => ({
  label: STRATEGY_STATUS_LABEL[s],
  value: s as string,
}))

async function patchObjective(body: Record<string, unknown>) {
  const endpoint: string = `/api/strategy/objectives/${id}`
  await $fetch(endpoint, { method: 'PATCH', body })
  await refresh()
}
async function del() {
  if (!confirm('Delete this objective and its KPIs?')) return
  await $fetch(`/api/strategy/objectives/${id}`, { method: 'DELETE' })
  await navigateTo('/strategy')
}

// ── KPIs ──
const kpiOpen = ref(false)
const kpiForm = reactive({
  name: '',
  unit: '',
  baseline: '0',
  target: '',
  current: '0',
  direction: 'increase',
})
async function addKpi() {
  const parsed = kpiSchema.safeParse(kpiForm)
  if (!parsed.success) {
    toast.add({ title: 'KPI name required', color: 'warning' })
    return
  }
  await $fetch(`/api/strategy/objectives/${id}/kpis`, { method: 'POST', body: parsed.data })
  kpiOpen.value = false
  Object.assign(kpiForm, {
    name: '',
    unit: '',
    baseline: '0',
    target: '',
    current: '0',
    direction: 'increase',
  })
  await refresh()
}
async function updateKpiCurrent(k: Kpi) {
  const v = window.prompt(
    `Update current value for "${k.name}"${k.unit ? ` (${k.unit})` : ''}:`,
    k.current
  )
  if (v === null) return
  const endpoint: string = `/api/strategy/kpis/${k.id}`
  await $fetch(endpoint, { method: 'PATCH', body: { current: Number(v) } })
  await refresh()
}
async function delKpi(k: Kpi) {
  const endpoint: string = `/api/strategy/kpis/${k.id}`
  await $fetch(endpoint, { method: 'DELETE' })
  await refresh()
}

// ── Goals ──
const goalOpen = ref(false)
const goalForm = reactive({ title: '', department: '', ownerUserId: '', dueDate: '' })
async function addGoal() {
  const parsed = goalSchema.safeParse({
    ...goalForm,
    objectiveId: id,
    ownerUserId: goalForm.ownerUserId || null,
  })
  if (!parsed.success) {
    toast.add({ title: 'Goal title required', color: 'warning' })
    return
  }
  await $fetch('/api/strategy/goals', { method: 'POST', body: parsed.data })
  goalOpen.value = false
  Object.assign(goalForm, { title: '', department: '', ownerUserId: '', dueDate: '' })
  await refresh()
}
async function updateGoal(g: Goal, body: Record<string, unknown>) {
  const endpoint: string = `/api/strategy/goals/${g.id}`
  await $fetch(endpoint, { method: 'PATCH', body })
  await refresh()
}
function editGoalProgress(g: Goal) {
  const v = window.prompt('Progress %', String(g.progressPct))
  if (v !== null) updateGoal(g, { progressPct: Math.max(0, Math.min(100, Number(v))) })
}
async function delGoal(g: Goal) {
  if (!confirm('Delete this goal and its individual objectives?')) return
  const endpoint: string = `/api/strategy/goals/${g.id}`
  await $fetch(endpoint, { method: 'DELETE' })
  await refresh()
}

// ── Individual objectives ──
const indivOpen = ref(false)
const indivGoalId = ref('')
const indivForm = reactive({ userId: '', title: '' })
function openIndiv(goalId: string) {
  indivGoalId.value = goalId
  Object.assign(indivForm, { userId: '', title: '' })
  indivOpen.value = true
}
async function addIndiv() {
  const parsed = individualObjectiveSchema.safeParse({ ...indivForm, goalId: indivGoalId.value })
  if (!parsed.success) {
    toast.add({ title: 'Pick a person and title', color: 'warning' })
    return
  }
  await $fetch(`/api/strategy/goals/${indivGoalId.value}/individuals`, {
    method: 'POST',
    body: parsed.data,
  })
  indivOpen.value = false
  await refresh()
}
async function updateIndiv(i: Individual, body: Record<string, unknown>) {
  const endpoint: string = `/api/strategy/individuals/${i.id}`
  await $fetch(endpoint, { method: 'PATCH', body })
  await refresh()
}
function editIndivProgress(i: Individual) {
  const v = window.prompt('Progress %', String(i.progressPct))
  if (v !== null) updateIndiv(i, { progressPct: Math.max(0, Math.min(100, Number(v))) })
}
async function delIndiv(i: Individual) {
  const endpoint: string = `/api/strategy/individuals/${i.id}`
  await $fetch(endpoint, { method: 'DELETE' })
  await refresh()
}

// ── Check-ins ──
const checkinOpen = ref(false)
const checkinForm = reactive({ summary: '', ragStatus: 'on_track' })
async function addCheckin() {
  const parsed = checkinSchema.safeParse(checkinForm)
  if (!parsed.success) {
    toast.add({ title: 'Check the check-in', color: 'warning' })
    return
  }
  await $fetch(`/api/strategy/objectives/${id}/checkins`, { method: 'POST', body: parsed.data })
  checkinOpen.value = false
  Object.assign(checkinForm, { summary: '', ragStatus: 'on_track' })
  await refresh()
}
function fdt(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div v-if="data" class="space-y-6">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div class="flex items-center gap-4">
        <StrategyRagRing
          :progress="data.objective.progress"
          :status="data.objective.status"
          :size="72"
          :stroke="7"
        />
        <div>
          <UButton
            variant="link"
            color="neutral"
            icon="i-lucide-arrow-left"
            label="Strategy"
            class="-ml-2"
            @click="navigateTo('/strategy')"
          />
          <h1 class="text-2xl font-semibold tracking-tight text-default">
            {{ data.objective.title }}
          </h1>
          <p class="text-sm text-muted">
            {{
              [data.objective.theme, `${data.objective.year}`, data.objective.owner]
                .filter(Boolean)
                .join(' · ')
            }}
          </p>
          <UBadge
            :color="STRATEGY_STATUS_COLOR[data.objective.status]"
            variant="subtle"
            :label="STRATEGY_STATUS_LABEL[data.objective.status]"
            class="mt-1.5"
          />
        </div>
      </div>
      <div v-if="canEdit" class="flex items-center gap-2">
        <USelect
          :model-value="data.objective.manualStatus ?? ''"
          :items="[{ label: 'Auto (from KPIs)', value: '' }, ...statusItems]"
          value-key="value"
          class="w-44"
          @update:model-value="(v: string) => patchObjective({ manualStatus: v || null })"
        />
        <UButton
          icon="i-lucide-trash-2"
          variant="ghost"
          color="error"
          aria-label="Delete"
          @click="del"
        />
      </div>
    </div>
    <p
      v-if="data.objective.description"
      class="rounded-xl border border-default bg-default p-4 text-sm text-muted"
    >
      {{ data.objective.description }}
    </p>

    <!-- KPIs -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">Key results (KPIs)</h2>
        <UButton
          v-if="canEdit"
          size="xs"
          variant="soft"
          icon="i-lucide-plus"
          label="Add KPI"
          @click="kpiOpen = true"
        />
      </div>
      <p
        v-if="!data.kpis.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No KPIs yet — add measurable targets.
      </p>
      <div
        v-for="k in data.kpis"
        :key="k.id"
        class="rounded-xl border border-default bg-default p-4"
      >
        <div class="flex items-center justify-between gap-3">
          <div>
            <p class="font-medium text-default">{{ k.name }}</p>
            <p class="text-xs text-muted">
              {{ Number(k.baseline) }} →
              <span class="font-medium text-default">{{ Number(k.current) }}</span> /
              {{ k.target != null ? Number(k.target) : '—' }} {{ k.unit ?? '' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <UBadge
              :color="STRATEGY_STATUS_COLOR[k.status]"
              variant="subtle"
              size="xs"
              :label="`${k.progress}%`"
            />
            <template v-if="canEdit">
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-pencil-line"
                aria-label="Update"
                @click="updateKpiCurrent(k)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-x"
                aria-label="Remove"
                @click="delKpi(k)"
              />
            </template>
          </div>
        </div>
        <div class="mt-2 h-2 rounded-full bg-elevated">
          <div
            class="h-full rounded-full"
            :class="{
              'bg-success': k.status === 'on_track' || k.status === 'achieved',
              'bg-warning': k.status === 'at_risk',
              'bg-error': k.status === 'off_track',
              'bg-elevated': k.status === 'not_started',
            }"
            :style="{ width: `${k.progress}%` }"
          />
        </div>
      </div>
    </section>

    <!-- Departmental goals cascade -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">Departmental goals</h2>
        <UButton
          v-if="canEdit"
          size="xs"
          variant="soft"
          icon="i-lucide-plus"
          label="Add goal"
          @click="goalOpen = true"
        />
      </div>
      <p
        v-if="!data.goals.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No goals cascade from this objective yet.
      </p>
      <div
        v-for="g in data.goals"
        :key="g.id"
        class="rounded-xl border border-default bg-default p-4"
      >
        <div class="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p class="font-medium text-default">{{ g.title }}</p>
            <p class="text-xs text-muted">
              {{ [g.department, g.owner].filter(Boolean).join(' · ') || '—' }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <USelect
              v-if="canEdit"
              :model-value="g.status"
              :items="statusItems"
              value-key="value"
              size="xs"
              class="w-32"
              @update:model-value="(s: string) => updateGoal(g, { status: s })"
            />
            <UBadge
              v-else
              :color="STRATEGY_STATUS_COLOR[g.status]"
              variant="subtle"
              size="xs"
              :label="STRATEGY_STATUS_LABEL[g.status]"
            />
            <UButton
              v-if="canEdit"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Remove"
              @click="delGoal(g)"
            />
          </div>
        </div>
        <div class="mt-2 flex items-center gap-2">
          <div class="h-2 flex-1 rounded-full bg-elevated">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${g.progressPct}%` }" />
          </div>
          <span class="text-xs text-muted">{{ g.progressPct }}%</span>
          <UButton
            v-if="canEdit"
            size="xs"
            variant="ghost"
            color="neutral"
            icon="i-lucide-pencil-line"
            aria-label="Set progress"
            @click="editGoalProgress(g)"
          />
        </div>
        <!-- Individuals -->
        <div class="mt-3 space-y-1.5 border-t border-default pt-3">
          <div v-for="i in g.individuals" :key="i.id" class="flex items-center gap-2 text-sm">
            <UIcon name="i-lucide-corner-down-right" class="size-3.5 text-muted" />
            <span class="min-w-0 flex-1 truncate text-default"
              >{{ i.title }} <span class="text-xs text-muted">· {{ i.owner }}</span></span
            >
            <div class="h-1.5 w-16 rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-primary/70"
                :style="{ width: `${i.progressPct}%` }"
              />
            </div>
            <UButton
              v-if="canEdit"
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-pencil-line"
              aria-label="Update"
              @click="editIndivProgress(i)"
            />
            <UButton
              v-if="canEdit"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Remove"
              @click="delIndiv(i)"
            />
          </div>
          <UButton
            v-if="canEdit"
            size="xs"
            variant="link"
            color="neutral"
            icon="i-lucide-plus"
            label="Link individual objective"
            @click="openIndiv(g.id)"
          />
        </div>
      </div>
    </section>

    <!-- Check-ins -->
    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">Review check-ins</h2>
        <UButton
          v-if="canEdit"
          size="xs"
          variant="soft"
          icon="i-lucide-plus"
          label="New check-in"
          @click="checkinOpen = true"
        />
      </div>
      <p
        v-if="!data.checkins.length"
        class="rounded-xl border border-dashed border-default p-8 text-center text-sm text-muted"
      >
        No check-ins recorded.
      </p>
      <div
        v-for="c in data.checkins"
        :key="c.id"
        class="flex gap-3 rounded-xl border border-default bg-default p-4"
      >
        <UBadge
          :color="STRATEGY_STATUS_COLOR[c.ragStatus]"
          variant="subtle"
          size="xs"
          :label="STRATEGY_STATUS_LABEL[c.ragStatus]"
          class="mt-0.5 shrink-0"
        />
        <div class="min-w-0 flex-1">
          <p v-if="c.summary" class="text-sm text-default">{{ c.summary }}</p>
          <p class="mt-1 text-xs text-muted">{{ c.author }} · {{ fdt(c.createdAt) }}</p>
        </div>
      </div>
    </section>

    <!-- Modals -->
    <UModal v-model:open="kpiOpen" title="Add KPI">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required
            ><UInput v-model="kpiForm.name" autofocus placeholder="e.g. Consulting revenue"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Unit"
              ><UInput v-model="kpiForm.unit" placeholder="USD, %, count"
            /></UFormField>
            <UFormField label="Direction"
              ><USelect
                v-model="kpiForm.direction"
                :items="[
                  { label: 'Increase', value: 'increase' },
                  { label: 'Decrease', value: 'decrease' },
                ]"
                value-key="value"
                class="w-full"
            /></UFormField>
            <UFormField label="Baseline"
              ><UInput v-model="kpiForm.baseline" type="number"
            /></UFormField>
            <UFormField label="Target"
              ><UInput v-model="kpiForm.target" type="number"
            /></UFormField>
            <UFormField label="Current"
              ><UInput v-model="kpiForm.current" type="number"
            /></UFormField>
          </div>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="kpiOpen = false"
          /><UButton label="Add KPI" @click="addKpi" /></div
      ></template>
    </UModal>

    <UModal v-model:open="goalOpen" title="Add departmental goal">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title" required
            ><UInput v-model="goalForm.title" autofocus
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Department"><UInput v-model="goalForm.department" /></UFormField>
            <UFormField label="Owner"
              ><USelect
                v-model="goalForm.ownerUserId"
                :items="peopleItems"
                value-key="value"
                class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Due date"
            ><UInput v-model="goalForm.dueDate" type="date"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="goalOpen = false"
          /><UButton label="Add goal" @click="addGoal" /></div
      ></template>
    </UModal>

    <UModal v-model:open="indivOpen" title="Link individual objective">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Staff member" required
            ><USelect
              v-model="indivForm.userId"
              :items="peopleItems"
              value-key="value"
              class="w-full"
              placeholder="Select…"
          /></UFormField>
          <UFormField label="Objective" required
            ><UInput v-model="indivForm.title" autofocus
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="indivOpen = false"
          /><UButton label="Link" @click="addIndiv" /></div
      ></template>
    </UModal>

    <UModal v-model:open="checkinOpen" title="New review check-in">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Status"
            ><USelect
              v-model="checkinForm.ragStatus"
              :items="statusItems"
              value-key="value"
              class="w-full"
          /></UFormField>
          <UFormField label="Summary"
            ><UTextarea
              v-model="checkinForm.summary"
              :rows="3"
              class="w-full"
              placeholder="Progress, blockers, next steps…"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton
            variant="ghost"
            color="neutral"
            label="Cancel"
            @click="checkinOpen = false"
          /><UButton label="Record" @click="addCheckin" /></div
      ></template>
    </UModal>
  </div>
</template>
