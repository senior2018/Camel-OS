<script setup lang="ts">
import {
  STRATEGY_STATUS_COLOR,
  STRATEGY_STATUS_LABEL,
  type StrategyStatus,
} from '@@/shared/schemas/strategy'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Strategy Report — Camel OS' })

const { can } = await usePermissions()
if (!can.value('strategy', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

const year = ref(new Date().getFullYear())
interface Kpi {
  name: string
  unit: string | null
  baseline: number
  target: number | null
  current: number
  progress: number
  status: StrategyStatus
}
interface Item {
  title: string
  description: string | null
  theme: string | null
  owner: string | null
  status: StrategyStatus
  progress: number
  kpis: Kpi[]
  goals: { title: string; department: string | null; progressPct: number; status: StrategyStatus }[]
  latestCheckin: { summary: string | null; ragStatus: StrategyStatus } | null
}
const { data } = await useFetch<{
  year: number
  items: Item[]
  summary: Record<StrategyStatus, number>
  avgProgress: number
  totalObjectives: number
}>('/api/strategy/report', {
  query: { year },
  key: 'strategy-report',
  default: () => ({
    year: year.value,
    items: [],
    summary: { not_started: 0, on_track: 0, at_risk: 0, off_track: 0, achieved: 0 },
    avgProgress: 0,
    totalObjectives: 0,
  }),
})
const yearItems = computed(() => {
  const set = new Set<number>([year.value, new Date().getFullYear(), new Date().getFullYear() - 1])
  return [...set].sort((a, b) => b - a).map((y) => ({ label: String(y), value: y }))
})
function printReport() {
  window.print()
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-wrap items-end justify-between gap-3 print:hidden">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Annual Strategy Review</h1>
        <p class="mt-1 text-sm text-muted">
          A board-ready summary of objectives, KPIs, and progress.
        </p>
      </div>
      <div class="flex items-center gap-2">
        <USelect v-model="year" :items="yearItems" value-key="value" class="w-28" />
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-printer"
          label="Print / PDF"
          @click="printReport"
        />
        <UButton
          to="/strategy"
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Dashboard"
        />
      </div>
    </header>

    <!-- Printable body -->
    <div class="space-y-6">
      <div class="hidden print:block">
        <h1 class="text-2xl font-bold">Annual Strategy Review · {{ data.year }}</h1>
      </div>

      <!-- Executive summary -->
      <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div class="rounded-xl border border-default bg-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Objectives</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ data.totalObjectives }}</p>
        </div>
        <div class="rounded-xl border border-primary/30 bg-primary/5 p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Avg progress</p>
          <p class="mt-1 text-2xl font-semibold text-primary">{{ data.avgProgress }}%</p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">On track</p>
          <p class="mt-1 text-2xl font-semibold text-success">
            {{ data.summary.on_track + data.summary.achieved }}
          </p>
        </div>
        <div class="rounded-xl border border-default bg-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">At risk / off</p>
          <p class="mt-1 text-2xl font-semibold text-warning">
            {{ data.summary.at_risk + data.summary.off_track }}
          </p>
        </div>
      </div>

      <p
        v-if="!data.items.length"
        class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
      >
        No objectives for {{ data.year }}.
      </p>

      <!-- Each objective -->
      <div
        v-for="(o, i) in data.items"
        :key="i"
        class="break-inside-avoid space-y-3 rounded-xl border border-default bg-default p-5"
      >
        <div class="flex items-start justify-between gap-3">
          <div>
            <p v-if="o.theme" class="text-xs uppercase tracking-wide text-muted">{{ o.theme }}</p>
            <h3 class="text-lg font-semibold text-default">{{ o.title }}</h3>
            <p v-if="o.owner" class="text-xs text-muted">Owner: {{ o.owner }}</p>
          </div>
          <div class="text-right">
            <UBadge
              :color="STRATEGY_STATUS_COLOR[o.status]"
              variant="subtle"
              :label="STRATEGY_STATUS_LABEL[o.status]"
            />
            <p class="mt-1 text-sm font-semibold text-default">{{ o.progress }}%</p>
          </div>
        </div>
        <p v-if="o.description" class="text-sm text-muted">{{ o.description }}</p>

        <table v-if="o.kpis.length" class="w-full text-sm">
          <thead class="text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th class="py-1 font-medium">KPI</th>
              <th class="py-1 font-medium">Baseline</th>
              <th class="py-1 font-medium">Current</th>
              <th class="py-1 font-medium">Target</th>
              <th class="py-1 text-right font-medium">Progress</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-default">
            <tr v-for="(k, ki) in o.kpis" :key="ki">
              <td class="py-1.5 text-default">{{ k.name }}</td>
              <td class="py-1.5 text-muted">{{ k.baseline }}</td>
              <td class="py-1.5 font-medium text-default">{{ k.current }}</td>
              <td class="py-1.5 text-muted">{{ k.target ?? '—' }} {{ k.unit ?? '' }}</td>
              <td class="py-1.5 text-right">
                <UBadge
                  :color="STRATEGY_STATUS_COLOR[k.status]"
                  variant="subtle"
                  size="xs"
                  :label="`${k.progress}%`"
                />
              </td>
            </tr>
          </tbody>
        </table>

        <div v-if="o.goals.length" class="text-sm">
          <p class="text-xs uppercase tracking-wide text-muted">Departmental goals</p>
          <ul class="mt-1 space-y-0.5">
            <li
              v-for="(g, gi) in o.goals"
              :key="gi"
              class="flex items-center justify-between text-default"
            >
              <span
                >{{ g.title
                }}<span v-if="g.department" class="text-muted"> · {{ g.department }}</span></span
              ><span class="text-muted">{{ g.progressPct }}%</span>
            </li>
          </ul>
        </div>

        <p v-if="o.latestCheckin?.summary" class="rounded-lg bg-elevated/40 p-2 text-sm text-muted">
          <span class="font-medium text-default">Latest review:</span> {{ o.latestCheckin.summary }}
        </p>
      </div>
    </div>
  </div>
</template>
