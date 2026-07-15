<script setup lang="ts">
import {
  STRATEGY_STATUS_COLOR,
  STRATEGY_STATUS_LABEL,
  STRATEGY_STATUSES,
  checkinSchema,
  goalSchema,
  individualObjectiveSchema,
  individualObjectiveUpdateSchema,
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
// Nuxt UI USelect can't take an empty-string value — use a sentinel for "none".
const NONE = '__none__'
const peopleItems = computed(() => [
  { label: '— Unassigned —', value: NONE },
  ...(people.value?.items ?? []).map((p) => ({ label: p.name, value: p.id })),
])
const statusItems = STRATEGY_STATUSES.map((s) => ({
  label: STRATEGY_STATUS_LABEL[s],
  value: s as string,
}))
const AUTO = '__auto__'
const objectiveStatusItems = [{ label: 'Auto (from KPIs)', value: AUTO }, ...statusItems]

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

// ── Edit the objective's own details ──
const editObjOpen = ref(false)
const editObjForm = reactive({
  title: '',
  theme: '',
  description: '',
  ownerUserId: NONE,
  year: 2026,
})
function openEditObj() {
  const o = data.value?.objective
  if (!o) return
  editObjForm.title = o.title
  editObjForm.theme = o.theme ?? ''
  editObjForm.description = o.description ?? ''
  editObjForm.year = o.year
  editObjForm.ownerUserId = people.value?.items.find((p) => p.name === o.owner)?.id ?? NONE
  editObjOpen.value = true
}
const savingObj = ref(false)
async function saveObjective() {
  if (!editObjForm.title.trim()) {
    toast.add({ title: 'A title is required', color: 'warning' })
    return
  }
  savingObj.value = true
  try {
    await patchObjective({
      title: editObjForm.title.trim(),
      theme: editObjForm.theme.trim() || null,
      description: editObjForm.description.trim() || null,
      year: editObjForm.year,
      ownerUserId: editObjForm.ownerUserId === NONE ? null : editObjForm.ownerUserId,
    })
    editObjOpen.value = false
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    savingObj.value = false
  }
}

const directionItems = [
  { label: 'Increase', value: 'increase' },
  { label: 'Decrease', value: 'decrease' },
]

// ── KPIs: full edit modal + a quick "update actual" modal (ST-03) ──
const kpiOpen = ref(false)
const kpiForm = reactive({
  id: null as string | null,
  name: '',
  unit: '',
  baseline: '0',
  target: '',
  current: '0',
  direction: 'increase',
})
function openKpi(k?: Kpi) {
  kpiForm.id = k?.id ?? null
  kpiForm.name = k?.name ?? ''
  kpiForm.unit = k?.unit ?? ''
  kpiForm.baseline = k ? String(Number(k.baseline)) : '0'
  kpiForm.target = k?.target != null ? String(Number(k.target)) : ''
  kpiForm.current = k ? String(Number(k.current)) : '0'
  kpiForm.direction = k?.direction ?? 'increase'
  kpiOpen.value = true
}
const savingKpi = ref(false)
async function saveKpi() {
  const parsed = kpiSchema.safeParse({ ...kpiForm })
  if (!parsed.success) {
    toast.add({ title: 'KPI name required', color: 'warning' })
    return
  }
  savingKpi.value = true
  try {
    if (kpiForm.id) {
      await $fetch(`/api/strategy/kpis/${kpiForm.id}`, { method: 'PATCH', body: parsed.data })
    } else {
      await $fetch(`/api/strategy/objectives/${id}/kpis`, { method: 'POST', body: parsed.data })
    }
    kpiOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Could not save KPI', color: 'error' })
  } finally {
    savingKpi.value = false
  }
}
// Quick "log actual" — the check-in action from ST-03, as a modal (not a prompt).
const kpiValueOpen = ref(false)
const kpiValueTarget = ref<Kpi | null>(null)
const kpiValue = ref<number | null>(null)
const savingKpiValue = ref(false)
function openKpiValue(k: Kpi) {
  kpiValueTarget.value = k
  kpiValue.value = Number(k.current)
  kpiValueOpen.value = true
}
async function saveKpiValue() {
  if (!kpiValueTarget.value || kpiValue.value == null) return
  savingKpiValue.value = true
  try {
    await $fetch(`/api/strategy/kpis/${kpiValueTarget.value.id}`, {
      method: 'PATCH',
      body: { current: Number(kpiValue.value) },
    })
    kpiValueOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Could not update', color: 'error' })
  } finally {
    savingKpiValue.value = false
  }
}
async function delKpi(k: Kpi) {
  if (!confirm(`Delete KPI "${k.name}"?`)) return
  await $fetch(`/api/strategy/kpis/${k.id}`, { method: 'DELETE' })
  await refresh()
}

// ── Goals: full edit modal ──
const goalOpen = ref(false)
const goalForm = reactive({
  id: null as string | null,
  title: '',
  department: '',
  ownerUserId: NONE,
  dueDate: '',
  progressPct: 0,
  status: 'not_started' as StrategyStatus,
})
function openGoal(g?: Goal) {
  goalForm.id = g?.id ?? null
  goalForm.title = g?.title ?? ''
  goalForm.department = g?.department ?? ''
  goalForm.ownerUserId = people.value?.items.find((p) => p.name === g?.owner)?.id ?? NONE
  goalForm.dueDate = g?.dueDate ?? ''
  goalForm.progressPct = g?.progressPct ?? 0
  goalForm.status = g?.status ?? 'not_started'
  goalOpen.value = true
}
const savingGoal = ref(false)
async function saveGoal() {
  const payload = {
    title: goalForm.title,
    department: goalForm.department || null,
    dueDate: goalForm.dueDate || null,
    progressPct: goalForm.progressPct,
    status: goalForm.status,
    ownerUserId: goalForm.ownerUserId === NONE ? null : goalForm.ownerUserId,
    ...(goalForm.id ? {} : { objectiveId: id }),
  }
  const parsed = (goalForm.id ? goalSchema.partial() : goalSchema).safeParse(payload)
  if (!parsed.success) {
    toast.add({ title: 'Goal title required', color: 'warning' })
    return
  }
  savingGoal.value = true
  try {
    if (goalForm.id) {
      await $fetch(`/api/strategy/goals/${goalForm.id}`, { method: 'PATCH', body: parsed.data })
    } else {
      await $fetch('/api/strategy/goals', { method: 'POST', body: parsed.data })
    }
    goalOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Could not save goal', color: 'error' })
  } finally {
    savingGoal.value = false
  }
}
async function updateGoalStatus(g: Goal, status: string) {
  await $fetch(`/api/strategy/goals/${g.id}`, { method: 'PATCH', body: { status } })
  await refresh()
}
async function delGoal(g: Goal) {
  if (!confirm('Delete this goal and its individual objectives?')) return
  await $fetch(`/api/strategy/goals/${g.id}`, { method: 'DELETE' })
  await refresh()
}

// ── Individual objectives: full edit modal ──
const indivOpen = ref(false)
const indivGoalId = ref('')
const indivForm = reactive({
  id: null as string | null,
  userId: NONE,
  title: '',
  progressPct: 0,
  status: 'not_started' as StrategyStatus,
})
function openIndiv(goalId: string, i?: Individual) {
  indivGoalId.value = goalId
  indivForm.id = i?.id ?? null
  indivForm.userId = i?.userId ?? NONE
  indivForm.title = i?.title ?? ''
  indivForm.progressPct = i?.progressPct ?? 0
  indivForm.status = i?.status ?? 'not_started'
  indivOpen.value = true
}
const savingIndiv = ref(false)
async function saveIndiv() {
  savingIndiv.value = true
  try {
    if (indivForm.id) {
      const parsed = individualObjectiveUpdateSchema.safeParse({
        title: indivForm.title,
        progressPct: indivForm.progressPct,
        status: indivForm.status,
      })
      if (!parsed.success) {
        toast.add({ title: 'A title is required', color: 'warning' })
        return
      }
      await $fetch(`/api/strategy/individuals/${indivForm.id}`, {
        method: 'PATCH',
        body: parsed.data,
      })
    } else {
      const parsed = individualObjectiveSchema.safeParse({
        goalId: indivGoalId.value,
        userId: indivForm.userId === NONE ? undefined : indivForm.userId,
        title: indivForm.title,
      })
      if (!parsed.success) {
        toast.add({ title: 'Pick a person and title', color: 'warning' })
        return
      }
      await $fetch(`/api/strategy/goals/${indivGoalId.value}/individuals`, {
        method: 'POST',
        body: parsed.data,
      })
    }
    indivOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Could not save', color: 'error' })
  } finally {
    savingIndiv.value = false
  }
}
async function delIndiv(i: Individual) {
  await $fetch(`/api/strategy/individuals/${i.id}`, { method: 'DELETE' })
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
          :model-value="data.objective.manualStatus ?? AUTO"
          :items="objectiveStatusItems"
          value-key="value"
          class="w-44"
          @update:model-value="
            (v: string) => patchObjective({ manualStatus: v === AUTO ? null : v })
          "
        />
        <UButton
          icon="i-lucide-pencil"
          variant="outline"
          color="neutral"
          label="Edit"
          @click="openEditObj"
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
          @click="openKpi()"
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
                variant="soft"
                color="primary"
                icon="i-lucide-trending-up"
                label="Log value"
                @click="openKpiValue(k)"
              />
              <UButton
                size="xs"
                variant="ghost"
                color="neutral"
                icon="i-lucide-pencil"
                aria-label="Edit KPI"
                @click="openKpi(k)"
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
          @click="openGoal()"
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
              @update:model-value="(s: string) => updateGoalStatus(g, s)"
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
              color="neutral"
              icon="i-lucide-pencil"
              aria-label="Edit goal"
              @click="openGoal(g)"
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
              icon="i-lucide-pencil"
              aria-label="Edit"
              @click="openIndiv(g.id, i)"
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
    <UModal v-model:open="editObjOpen" title="Edit objective">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title" required>
            <UInput v-model="editObjForm.title" autofocus class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Theme"
              ><UInput v-model="editObjForm.theme" class="w-full"
            /></UFormField>
            <UFormField label="Year">
              <UInputNumber v-model="editObjForm.year" :min="2000" :max="2100" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Owner">
            <USelect
              v-model="editObjForm.ownerUserId"
              :items="peopleItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="editObjForm.description" :rows="3" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="editObjOpen = false" />
          <UButton label="Save" :loading="savingObj" @click="saveObjective" />
        </div>
      </template>
    </UModal>

    <!-- KPI full edit -->
    <UModal v-model:open="kpiOpen" :title="kpiForm.id ? 'Edit KPI' : 'Add KPI'">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required>
            <UInput
              v-model="kpiForm.name"
              autofocus
              class="w-full"
              placeholder="e.g. Consulting revenue"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Unit">
              <UInput v-model="kpiForm.unit" placeholder="USD, %, count" class="w-full" />
            </UFormField>
            <UFormField label="Direction">
              <USelect
                v-model="kpiForm.direction"
                :items="directionItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Baseline">
              <UInput v-model="kpiForm.baseline" type="number" class="w-full" />
            </UFormField>
            <UFormField label="Annual target">
              <UInput v-model="kpiForm.target" type="number" class="w-full" />
            </UFormField>
            <UFormField label="Current value">
              <UInput v-model="kpiForm.current" type="number" class="w-full" />
            </UFormField>
          </div>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="kpiOpen = false" />
          <UButton :label="kpiForm.id ? 'Save' : 'Add KPI'" :loading="savingKpi" @click="saveKpi" />
        </div>
      </template>
    </UModal>

    <!-- KPI quick "log actual" (ST-03 check-in update) -->
    <UModal v-model:open="kpiValueOpen" title="Log KPI actual">
      <template #body>
        <div v-if="kpiValueTarget" class="space-y-3">
          <p class="text-sm text-muted">
            {{ kpiValueTarget.name }} — baseline {{ Number(kpiValueTarget.baseline) }} → target
            {{ kpiValueTarget.target != null ? Number(kpiValueTarget.target) : '—' }}
            {{ kpiValueTarget.unit ?? '' }}
          </p>
          <UFormField
            :label="`Current value${kpiValueTarget.unit ? ` (${kpiValueTarget.unit})` : ''}`"
            required
          >
            <UInputNumber v-model="kpiValue" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="kpiValueOpen = false" />
          <UButton label="Save" :loading="savingKpiValue" @click="saveKpiValue" />
        </div>
      </template>
    </UModal>

    <!-- Goal full edit -->
    <UModal v-model:open="goalOpen" :title="goalForm.id ? 'Edit goal' : 'Add departmental goal'">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title" required>
            <UInput v-model="goalForm.title" autofocus class="w-full" />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Department">
              <UInput v-model="goalForm.department" class="w-full" />
            </UFormField>
            <UFormField label="Owner">
              <USelect
                v-model="goalForm.ownerUserId"
                :items="peopleItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Due date">
              <UInput v-model="goalForm.dueDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="Status">
              <USelect
                v-model="goalForm.status"
                :items="statusItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
          </div>
          <UFormField :label="`Progress — ${goalForm.progressPct}%`">
            <UInputNumber v-model="goalForm.progressPct" :min="0" :max="100" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="goalOpen = false" />
          <UButton
            :label="goalForm.id ? 'Save' : 'Add goal'"
            :loading="savingGoal"
            @click="saveGoal"
          />
        </div>
      </template>
    </UModal>

    <!-- Individual objective (create + edit) -->
    <UModal
      v-model:open="indivOpen"
      :title="indivForm.id ? 'Edit individual objective' : 'Link individual objective'"
    >
      <template #body>
        <div class="space-y-3">
          <UFormField v-if="!indivForm.id" label="Staff member" required>
            <USelect
              v-model="indivForm.userId"
              :items="peopleItems"
              value-key="value"
              class="w-full"
              placeholder="Select…"
            />
          </UFormField>
          <UFormField label="Objective" required>
            <UInput v-model="indivForm.title" autofocus class="w-full" />
          </UFormField>
          <template v-if="indivForm.id">
            <UFormField label="Status">
              <USelect
                v-model="indivForm.status"
                :items="statusItems"
                value-key="value"
                class="w-full"
              />
            </UFormField>
            <UFormField :label="`Progress — ${indivForm.progressPct}%`">
              <UInputNumber v-model="indivForm.progressPct" :min="0" :max="100" class="w-full" />
            </UFormField>
          </template>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="indivOpen = false" />
          <UButton
            :label="indivForm.id ? 'Save' : 'Link'"
            :loading="savingIndiv"
            @click="saveIndiv"
          />
        </div>
      </template>
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
