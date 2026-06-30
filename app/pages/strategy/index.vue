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

// Group objectives by theme
const themed = computed(() => {
  const map = new Map<string, Objective[]>()
  for (const o of data.value?.items ?? []) {
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

    <!-- Hero roll-up -->
    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div
        class="flex items-center gap-4 rounded-xl border border-default bg-default p-5 lg:col-span-1"
      >
        <StrategyRagRing
          :progress="avgProgress"
          :status="avgProgress >= 80 ? 'on_track' : avgProgress >= 50 ? 'at_risk' : 'off_track'"
          :size="80"
          :stroke="8"
        />
        <div>
          <p class="text-sm text-muted">
            {{ total }} objective{{ total === 1 ? '' : 's' }} · {{ year }}
          </p>
          <p class="text-lg font-semibold text-default">{{ avgProgress }}% average progress</p>
        </div>
      </div>
      <div class="rounded-xl border border-default bg-default p-5 lg:col-span-2">
        <p class="mb-3 text-xs uppercase tracking-wide text-muted">Portfolio health</p>
        <div v-if="total" class="flex h-3 overflow-hidden rounded-full">
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
              'bg-elevated': s.status === 'not_started',
            }"
          />
        </div>
        <p v-else class="text-sm text-muted">No objectives yet for {{ year }}.</p>
        <div class="mt-3 flex flex-wrap gap-3">
          <span
            v-for="s in statusCounts"
            :key="s.status"
            class="flex items-center gap-1.5 text-xs text-muted"
          >
            <UBadge
              :color="STRATEGY_STATUS_COLOR[s.status]"
              variant="subtle"
              size="xs"
              :label="`${STRATEGY_STATUS_LABEL[s.status]} · ${s.count}`"
            />
          </span>
        </div>
      </div>
    </div>

    <!-- Objectives by theme -->
    <div v-if="!total" class="rounded-xl border border-dashed border-default p-12 text-center">
      <UIcon name="i-lucide-target" class="size-10 text-muted" />
      <p class="mt-2 text-sm text-muted">No strategic objectives for {{ year }}.</p>
    </div>
    <div v-for="group in themed" :key="group.theme" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">{{ group.theme }}</h2>
      <div class="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        <button
          v-for="o in group.items"
          :key="o.id"
          type="button"
          class="flex items-center gap-4 rounded-xl border border-default bg-default p-4 text-left transition-colors hover:border-primary/50 hover:shadow-sm"
          @click="navigateTo(`/strategy/objectives/${o.id}`)"
        >
          <StrategyRagRing :progress="o.progress" :status="o.status" :size="56" :stroke="5" />
          <div class="min-w-0 flex-1">
            <p class="truncate font-medium text-default">{{ o.title }}</p>
            <p class="text-xs text-muted">
              {{ o.kpiCount }} KPI{{ o.kpiCount === 1 ? '' : 's'
              }}<span v-if="o.owner"> · {{ o.owner }}</span>
            </p>
            <UBadge
              :color="STRATEGY_STATUS_COLOR[o.status]"
              variant="subtle"
              size="xs"
              :label="STRATEGY_STATUS_LABEL[o.status]"
              class="mt-1.5"
            />
          </div>
        </button>
      </div>
    </div>

    <!-- My objectives -->
    <div v-if="mine.items.length" class="space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wide text-muted">My objectives</h2>
      <div class="overflow-hidden rounded-xl border border-default">
        <div
          v-for="i in mine.items"
          :key="i.id"
          class="flex items-center gap-3 border-b border-default px-4 py-2.5 last:border-0"
        >
          <div class="min-w-0 flex-1">
            <p class="truncate text-sm font-medium text-default">{{ i.title }}</p>
            <p class="truncate text-xs text-muted">
              {{ [i.objectiveTitle, i.goalTitle].filter(Boolean).join(' → ') || 'Personal' }}
            </p>
          </div>
          <div class="h-2 w-24 shrink-0 rounded-full bg-elevated">
            <div class="h-full rounded-full bg-primary" :style="{ width: `${i.progressPct}%` }" />
          </div>
          <span class="w-10 text-right text-xs text-muted">{{ i.progressPct }}%</span>
        </div>
      </div>
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
