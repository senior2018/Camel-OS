<script setup lang="ts">
import {
  STRATEGY_STATUS_COLOR,
  STRATEGY_STATUS_LABEL,
  STRATEGY_STATUSES,
  objectiveSchema,
  type StrategyStatus,
} from '@@/shared/schemas/strategy'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Strategy — Camel OS' })

const { can } = await usePermissions()
if (!can.value('strategy', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canCreate = computed(() => can.value('strategy', 'create'))
const toast = useToast()

interface Objective {
  id: string
  year: number
  title: string
  theme: string | null
  owner: string | null
  kpiCount: number
  progress: number
  status: StrategyStatus
}
const year = ref<number>(new Date().getFullYear())
const { data, refresh } = await useFetch<{ items: Objective[]; years: number[] }>(
  '/api/strategy/objectives',
  {
    query: { year },
    key: 'strategy-objectives',
    default: () => ({ items: [], years: [] }),
  }
)
const { data: mine } = await useFetch<{
  items: {
    id: string
    title: string
    progressPct: number
    status: StrategyStatus
    goalTitle: string | null
    objectiveTitle: string | null
  }[]
}>('/api/strategy/my-objectives', { key: 'my-objectives', default: () => ({ items: [] }) })

const yearItems = computed(() => {
  const set = new Set<number>([year.value, new Date().getFullYear(), ...(data.value?.years ?? [])])
  return [...set].sort((a, b) => b - a).map((y) => ({ label: String(y), value: y }))
})

// Hero roll-up
const avgProgress = computed(() => {
  const items = data.value?.items ?? []
  return items.length ? Math.round(items.reduce((s, o) => s + o.progress, 0) / items.length) : 0
})
const statusCounts = computed(() =>
  STRATEGY_STATUSES.map((s) => ({
    status: s,
    count: (data.value?.items ?? []).filter((o) => o.status === s).length,
  })).filter((x) => x.count)
)
const total = computed(() => data.value?.items.length ?? 0)
const onTrackCount = computed(
  () =>
    (data.value?.items ?? []).filter((o) => o.status === 'on_track' || o.status === 'achieved')
      .length
)
// Objectives needing attention.
const needsAttention = computed(() =>
  (data.value?.items ?? [])
    .filter((o) => o.status === 'at_risk' || o.status === 'off_track')
    .sort((a, b) => a.progress - b.progress)
)
const heroStatus = computed<StrategyStatus>(() =>
  avgProgress.value >= 80 ? 'on_track' : avgProgress.value >= 50 ? 'at_risk' : 'off_track'
)

// Search + status filter
const search = ref('')
const statusFilter = ref<StrategyStatus[]>([])
const statusOptions = STRATEGY_STATUSES.map((s) => ({ label: STRATEGY_STATUS_LABEL[s], value: s }))
const filteredItems = computed(() => {
  const q = search.value.trim().toLowerCase()
  return (data.value?.items ?? []).filter((o) => {
    if (statusFilter.value.length && !statusFilter.value.includes(o.status)) return false
    if (q && !`${o.title} ${o.theme ?? ''} ${o.owner ?? ''}`.toLowerCase().includes(q)) return false
    return true
  })
})

// Group (filtered) objectives by theme
const themed = computed(() => {
  const map = new Map<string, Objective[]>()
  for (const o of filteredItems.value) {
    const key = o.theme || 'General'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(o)
  }
  return [...map.entries()].map(([theme, items]) => ({ theme, items }))
})

// Create objective
const open = ref(false)
const saving = ref(false)
const form = reactive({
  year: String(new Date().getFullYear()),
  title: '',
  theme: '',
  description: '',
})
async function create() {
  const parsed = objectiveSchema.safeParse({ ...form, year: form.year })
  if (!parsed.success) {
    toast.add({ title: 'A title and year are required', color: 'warning' })
    return
  }
  saving.value = true
  try {
    const res = await $fetch<{ objective: { id: string } }>('/api/strategy/objectives', {
      method: 'POST',
      body: parsed.data,
    })
    open.value = false
    await navigateTo(`/strategy/objectives/${res.objective.id}`)
  } catch {
    toast.add({ title: 'Could not create objective', color: 'error' })
  } finally {
    saving.value = false
  }
}
watch(year, () => refresh())
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Strategy</h1>
        <p class="mt-1 text-sm text-muted">
          Annual objectives, KPIs, and the goals that ladder up to them.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <USelect v-model="year" :items="yearItems" value-key="value" class="w-28" />
        <UButton
          to="/strategy/report"
          variant="outline"
          color="neutral"
          icon="i-lucide-file-text"
          label="Report"
        />
        <UButton v-if="canCreate" icon="i-lucide-plus" label="New objective" @click="open = true" />
      </div>
    </header>

    <!-- Stat tiles -->
    <div class="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        class="flex items-center gap-3 rounded-xl border border-default bg-default p-4 shadow-sm"
      >
        <StrategyRagRing :progress="avgProgress" :status="heroStatus" :size="52" :stroke="6" />
        <div>
          <p class="text-2xl font-semibold tracking-tight text-default">{{ avgProgress }}%</p>
          <p class="text-xs text-muted">Average progress</p>
        </div>
      </div>
      <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
        <p class="text-2xl font-semibold tracking-tight text-default">{{ total }}</p>
        <p class="text-xs text-muted">Objectives · {{ year }}</p>
      </div>
      <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
        <p class="text-2xl font-semibold tracking-tight text-success">{{ onTrackCount }}</p>
        <p class="text-xs text-muted">On track</p>
      </div>
      <div
        class="rounded-xl border p-4 shadow-sm"
        :class="
          needsAttention.length ? 'border-warning/40 bg-warning/5' : 'border-default bg-default'
        "
      >
        <p
          class="text-2xl font-semibold tracking-tight"
          :class="needsAttention.length ? 'text-warning' : 'text-default'"
        >
          {{ needsAttention.length }}
        </p>
        <p class="text-xs text-muted">Needs attention</p>
      </div>
    </div>

    <!-- Portfolio health bar -->
    <div class="rounded-xl border border-default bg-default p-4 shadow-sm">
      <div class="mb-2 flex items-center justify-between">
        <p class="text-xs uppercase tracking-wide text-muted">Portfolio health</p>
        <div class="flex flex-wrap gap-1.5">
          <UBadge
            v-for="s in statusCounts"
            :key="s.status"
            :color="STRATEGY_STATUS_COLOR[s.status]"
            variant="subtle"
            size="xs"
            :label="`${STRATEGY_STATUS_LABEL[s.status]} · ${s.count}`"
          />
        </div>
      </div>
      <div v-if="total" class="flex h-2.5 overflow-hidden rounded-full bg-elevated">
        <div
          v-for="s in statusCounts"
          :key="s.status"
          class="h-full"
          :style="{ width: `${(s.count / total) * 100}%` }"
          :class="{
            'bg-success': s.status === 'on_track',
            'bg-warning': s.status === 'at_risk',
            'bg-error': s.status === 'off_track',
            'bg-primary': s.status === 'achieved',
            'bg-neutral-300 dark:bg-neutral-600': s.status === 'not_started',
          }"
        />
      </div>
      <p v-else class="text-sm text-muted">No objectives yet for {{ year }}.</p>
    </div>

    <!-- Toolbar -->
    <div v-if="total" class="flex flex-col gap-2 sm:flex-row sm:items-center">
      <UInput
        v-model="search"
        icon="i-lucide-search"
        placeholder="Search objectives, theme, owner…"
        class="sm:max-w-xs"
      />
      <USelectMenu
        v-model="statusFilter"
        :items="statusOptions"
        value-key="value"
        multiple
        placeholder="Any status"
        class="sm:w-52"
      />
      <span class="text-xs text-muted sm:ml-auto">{{ filteredItems.length }} of {{ total }}</span>
    </div>

    <!-- Empty states -->
    <div v-if="!total" class="rounded-xl border border-dashed border-default p-12 text-center">
      <UIcon name="i-lucide-target" class="size-10 text-muted" />
      <p class="mt-2 text-sm text-muted">No strategic objectives for {{ year }}.</p>
    </div>
    <div
      v-else-if="!filteredItems.length"
      class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted"
    >
      No objectives match your search.
    </div>

    <!-- Objectives — full-width rows grouped by theme -->
    <section v-for="group in themed" :key="group.theme" class="space-y-2">
      <div class="flex items-center gap-2 px-1">
        <h2 class="text-xs font-semibold uppercase tracking-wide text-muted">{{ group.theme }}</h2>
        <span class="text-xs text-dimmed">· {{ group.items.length }}</span>
      </div>
      <div class="overflow-hidden rounded-xl border border-default bg-default shadow-sm">
        <button
          v-for="o in group.items"
          :key="o.id"
          type="button"
          class="flex w-full items-center gap-4 border-b border-default px-4 py-3.5 text-left transition-colors last:border-0 hover:bg-elevated/40"
          @click="navigateTo(`/strategy/objectives/${o.id}`)"
        >
          <StrategyRagRing :progress="o.progress" :status="o.status" :size="46" :stroke="5" />
          <div class="w-56 min-w-0 shrink-0">
            <p class="truncate font-medium text-default">{{ o.title }}</p>
            <p class="truncate text-xs text-muted">
              {{ o.kpiCount }} KPI{{ o.kpiCount === 1 ? '' : 's'
              }}<span v-if="o.owner"> · {{ o.owner }}</span>
            </p>
          </div>
          <div class="hidden flex-1 items-center gap-3 md:flex">
            <div class="h-2 flex-1 overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full"
                :class="{
                  'bg-success': o.status === 'on_track' || o.status === 'achieved',
                  'bg-warning': o.status === 'at_risk',
                  'bg-error': o.status === 'off_track',
                  'bg-neutral-300 dark:bg-neutral-600': o.status === 'not_started',
                }"
                :style="{ width: `${o.progress}%` }"
              />
            </div>
            <span class="w-10 shrink-0 text-right text-sm font-medium text-default">
              {{ o.progress }}%
            </span>
          </div>
          <UBadge
            :color="STRATEGY_STATUS_COLOR[o.status]"
            variant="subtle"
            size="xs"
            :label="STRATEGY_STATUS_LABEL[o.status]"
            class="shrink-0"
          />
          <UIcon name="i-lucide-chevron-right" class="size-4 shrink-0 text-muted" />
        </button>
      </div>
    </section>

    <!-- Needs attention + My objectives (bottom, full width) -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <UCard v-if="needsAttention.length">
        <template #header>
          <div class="flex items-center gap-2">
            <UIcon name="i-lucide-alert-triangle" class="size-4 text-warning" />
            <h3 class="text-sm font-semibold text-default">Needs attention</h3>
          </div>
        </template>
        <ul class="divide-y divide-default">
          <li
            v-for="o in needsAttention"
            :key="o.id"
            class="flex cursor-pointer items-center justify-between gap-2 py-2 transition-colors hover:bg-elevated/40"
            @click="navigateTo(`/strategy/objectives/${o.id}`)"
          >
            <div class="min-w-0">
              <p class="truncate text-sm text-default">{{ o.title }}</p>
              <p class="text-xs text-muted">{{ o.progress }}% · {{ o.owner || '—' }}</p>
            </div>
            <UBadge
              :color="STRATEGY_STATUS_COLOR[o.status]"
              variant="subtle"
              size="xs"
              :label="STRATEGY_STATUS_LABEL[o.status]"
            />
          </li>
        </ul>
      </UCard>

      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold text-default">My objectives</h3>
        </template>
        <ul v-if="mine.items.length" class="divide-y divide-default">
          <li v-for="i in mine.items" :key="i.id" class="py-2.5">
            <div class="flex items-center justify-between gap-2">
              <p class="min-w-0 flex-1 truncate text-sm font-medium text-default">{{ i.title }}</p>
              <span class="shrink-0 text-xs text-muted">{{ i.progressPct }}%</span>
            </div>
            <p class="truncate text-xs text-muted">
              {{ [i.objectiveTitle, i.goalTitle].filter(Boolean).join(' → ') || 'Personal' }}
            </p>
            <div class="mt-1 h-1.5 overflow-hidden rounded-full bg-elevated">
              <div class="h-full rounded-full bg-primary" :style="{ width: `${i.progressPct}%` }" />
            </div>
          </li>
        </ul>
        <p v-else class="py-4 text-center text-sm text-muted">
          No personal objectives linked to you.
        </p>
      </UCard>
    </div>

    <UModal v-model:open="open" title="New strategic objective">
      <template #body>
        <div class="space-y-3">
          <div class="grid grid-cols-3 gap-3">
            <UFormField label="Year" required
              ><UInput v-model="form.year" type="number"
            /></UFormField>
            <UFormField label="Theme / pillar" class="col-span-2"
              ><UInput v-model="form.theme" placeholder="e.g. Growth"
            /></UFormField>
          </div>
          <UFormField label="Title" required
            ><UInput v-model="form.title" autofocus placeholder="e.g. Grow consulting revenue 30%"
          /></UFormField>
          <UFormField label="Description"
            ><UTextarea v-model="form.description" :rows="2" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" /><UButton
            label="Create & define KPIs"
            :loading="saving"
            @click="create"
          /></div
      ></template>
    </UModal>
  </div>
</template>
