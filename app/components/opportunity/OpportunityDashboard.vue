<script setup lang="ts">
import {
  OPPORTUNITY_SOURCE_LABEL,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  type OpportunitySource,
  type OpportunityStage,
} from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

/**
 * OM-06 — Manager dashboard for opportunities. Aggregates the same in-memory
 * list the Kanban/List use, so adding it costs zero round-trips. Numbers shown:
 *  - Headline cards: total, pipeline value, weighted value, won YTD
 *  - By-stage breakdown with count + total value (horizontal bars)
 *  - By-source breakdown
 *  - Top 5 opportunities by estimated value
 *
 * "Weighted value" = sum of (value × winProbability/100) — the standard pipeline
 * forecast metric. Falls back to 50% probability when not set, mirroring how
 * most BD tools handle missing probability.
 */
interface Props {
  items: Opportunity[]
}

const props = defineProps<Props>()
const emit = defineEmits<{
  selectOpportunity: [opp: Opportunity]
}>()

function valueOf(opp: Opportunity): number {
  if (!opp.estimatedValue) return 0
  const n = Number(opp.estimatedValue)
  return Number.isNaN(n) ? 0 : n
}

const totalCount = computed(() => props.items.length)

const totalValue = computed(() => props.items.reduce((sum, o) => sum + valueOf(o), 0))

const weightedValue = computed(() =>
  props.items.reduce((sum, o) => {
    const prob = o.winProbability ?? 50
    return sum + (valueOf(o) * prob) / 100
  }, 0)
)

const wonValue = computed(() =>
  props.items.filter((o) => o.stage === 'won').reduce((sum, o) => sum + valueOf(o), 0)
)

const wonCount = computed(() => props.items.filter((o) => o.stage === 'won').length)

interface StageStat {
  stage: OpportunityStage
  label: string
  count: number
  value: number
}

const byStage = computed<StageStat[]>(() =>
  OPPORTUNITY_STAGES.map((stage) => {
    const subset = props.items.filter((o) => o.stage === stage)
    return {
      stage,
      label: OPPORTUNITY_STAGE_LABEL[stage],
      count: subset.length,
      value: subset.reduce((sum, o) => sum + valueOf(o), 0),
    }
  })
)

const maxStageValue = computed(() => Math.max(1, ...byStage.value.map((s) => s.value)))

interface SourceStat {
  source: OpportunitySource
  label: string
  count: number
  value: number
}

const bySource = computed<SourceStat[]>(() => {
  const grouped: Record<string, SourceStat> = {}
  for (const opp of props.items) {
    const key = opp.source
    if (!grouped[key]) {
      grouped[key] = {
        source: key,
        label: OPPORTUNITY_SOURCE_LABEL[key],
        count: 0,
        value: 0,
      }
    }
    grouped[key].count++
    grouped[key].value += valueOf(opp)
  }
  return Object.values(grouped).sort((a, b) => b.count - a.count)
})

const maxSourceCount = computed(() => Math.max(1, ...bySource.value.map((s) => s.count)))

const topByValue = computed(() =>
  [...props.items]
    .filter((o) => valueOf(o) > 0)
    .sort((a, b) => valueOf(b) - valueOf(a))
    .slice(0, 5)
)

function formatMoney(n: number, currency = 'USD'): string {
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}
</script>

<template>
  <div class="space-y-6">
    <!-- Headline cards -->
    <section class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <UCard :ui="{ body: 'p-5' }">
        <p class="text-xs uppercase tracking-wide text-muted">Total opportunities</p>
        <p class="mt-2 text-3xl font-semibold text-default">{{ totalCount }}</p>
      </UCard>
      <UCard :ui="{ body: 'p-5' }">
        <p class="text-xs uppercase tracking-wide text-muted">Pipeline value</p>
        <p class="mt-2 text-3xl font-semibold text-default">{{ formatMoney(totalValue) }}</p>
      </UCard>
      <UCard :ui="{ body: 'p-5' }">
        <p class="text-xs uppercase tracking-wide text-muted">Weighted forecast</p>
        <p class="mt-2 text-3xl font-semibold text-default">{{ formatMoney(weightedValue) }}</p>
        <p class="mt-1 text-xs text-dimmed">value × win probability</p>
      </UCard>
      <UCard :ui="{ body: 'p-5' }">
        <p class="text-xs uppercase tracking-wide text-muted">Won</p>
        <p class="mt-2 text-3xl font-semibold text-success">{{ formatMoney(wonValue) }}</p>
        <p class="mt-1 text-xs text-dimmed">{{ wonCount }} closed</p>
      </UCard>
    </section>

    <!-- By stage -->
    <section>
      <UCard>
        <template #header>
          <h2 class="font-semibold">Pipeline by stage</h2>
        </template>

        <ul class="space-y-3">
          <li v-for="stat in byStage" :key="stat.stage" class="space-y-1">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-default">{{ stat.label }}</span>
              <span class="text-muted">{{ stat.count }} · {{ formatMoney(stat.value) }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-primary transition-all"
                :style="{ width: `${(stat.value / maxStageValue) * 100}%` }"
              />
            </div>
          </li>
        </ul>
      </UCard>
    </section>

    <div class="grid gap-6 lg:grid-cols-2">
      <!-- By source -->
      <section>
        <UCard>
          <template #header>
            <h2 class="font-semibold">By source</h2>
          </template>
          <div v-if="!bySource.length" class="py-6 text-center text-sm text-muted">
            No data yet.
          </div>
          <ul v-else class="space-y-3">
            <li v-for="stat in bySource" :key="stat.source" class="space-y-1">
              <div class="flex items-center justify-between text-sm">
                <span class="font-medium text-default">{{ stat.label }}</span>
                <span class="text-muted">{{ stat.count }} · {{ formatMoney(stat.value) }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-elevated">
                <div
                  class="h-full rounded-full bg-primary/70 transition-all"
                  :style="{ width: `${(stat.count / maxSourceCount) * 100}%` }"
                />
              </div>
            </li>
          </ul>
        </UCard>
      </section>

      <!-- Top by value -->
      <section>
        <UCard>
          <template #header>
            <h2 class="font-semibold">Top opportunities</h2>
          </template>
          <div v-if="!topByValue.length" class="py-6 text-center text-sm text-muted">
            No opportunities with a value yet.
          </div>
          <ul v-else class="divide-y divide-default">
            <li v-for="opp in topByValue" :key="opp.id" class="py-2 first:pt-0 last:pb-0">
              <button
                type="button"
                class="w-full text-left"
                @click="emit('selectOpportunity', opp)"
              >
                <div class="flex items-center justify-between gap-3">
                  <span class="truncate text-sm font-medium text-default hover:text-primary">
                    {{ opp.title }}
                  </span>
                  <span class="shrink-0 text-sm font-semibold text-default">
                    {{ formatMoney(valueOf(opp), opp.currency) }}
                  </span>
                </div>
                <p class="mt-0.5 truncate text-xs text-muted">
                  {{ OPPORTUNITY_STAGE_LABEL[opp.stage] }} ·
                  {{ OPPORTUNITY_SOURCE_LABEL[opp.source] }}
                </p>
              </button>
            </li>
          </ul>
        </UCard>
      </section>
    </div>
  </div>
</template>
