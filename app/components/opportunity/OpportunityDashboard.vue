<script setup lang="ts">
import {
  OPPORTUNITY_SOURCE_LABEL,
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_LABEL,
  type OpportunitySource,
  type OpportunityStatus,
} from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

/**
 * OM-06 — Manager dashboard for opportunities (S7).
 *  - Headline cards: total count, accepted count, pending count, total value
 *  - By-status breakdown
 *  - By-source breakdown
 *  - Top 5 opportunities by estimated value
 *
 * Won / Lost numbers live in the Proposal module now; the opportunity dashboard
 * focuses on the *review* pipeline.
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

const pendingCount = computed(() => props.items.filter((o) => o.status === 'pending').length)
const acceptedCount = computed(() => props.items.filter((o) => o.status === 'accepted').length)
const acceptedValue = computed(() =>
  props.items.filter((o) => o.status === 'accepted').reduce((sum, o) => sum + valueOf(o), 0)
)

interface StatusStat {
  status: OpportunityStatus
  label: string
  count: number
  value: number
}

const byStatus = computed<StatusStat[]>(() =>
  OPPORTUNITY_STATUSES.map((status) => {
    const subset = props.items.filter((o) => o.status === status)
    return {
      status,
      label: OPPORTUNITY_STATUS_LABEL[status],
      count: subset.length,
      value: subset.reduce((sum, o) => sum + valueOf(o), 0),
    }
  })
)

const maxStatusValue = computed(() => Math.max(1, ...byStatus.value.map((s) => s.value)))

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
    let entry = grouped[key]
    if (!entry) {
      entry = {
        source: key,
        label: OPPORTUNITY_SOURCE_LABEL[key] ?? key,
        count: 0,
        value: 0,
      }
      grouped[key] = entry
    }
    entry.count++
    entry.value += valueOf(opp)
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
        <p class="text-xs uppercase tracking-wide text-muted">Pending review</p>
        <p class="mt-2 text-3xl font-semibold text-warning">{{ pendingCount }}</p>
        <p class="mt-1 text-xs text-dimmed">awaiting decision</p>
      </UCard>
      <UCard :ui="{ body: 'p-5' }">
        <p class="text-xs uppercase tracking-wide text-muted">Accepted</p>
        <p class="mt-2 text-3xl font-semibold text-success">{{ acceptedCount }}</p>
        <p class="mt-1 text-xs text-dimmed">{{ formatMoney(acceptedValue) }} in proposals</p>
      </UCard>
      <UCard :ui="{ body: 'p-5' }">
        <p class="text-xs uppercase tracking-wide text-muted">Pipeline value</p>
        <p class="mt-2 text-3xl font-semibold text-default">{{ formatMoney(totalValue) }}</p>
      </UCard>
    </section>

    <!-- By status -->
    <section>
      <UCard>
        <template #header>
          <h2 class="font-semibold">Pipeline by status</h2>
        </template>

        <ul class="space-y-3">
          <li v-for="stat in byStatus" :key="stat.status" class="space-y-1">
            <div class="flex items-center justify-between text-sm">
              <span class="font-medium text-default">{{ stat.label }}</span>
              <span class="text-muted">{{ stat.count }} · {{ formatMoney(stat.value) }}</span>
            </div>
            <div class="h-2 overflow-hidden rounded-full bg-elevated">
              <div
                class="h-full rounded-full bg-primary transition-all"
                :style="{ width: `${(stat.value / maxStatusValue) * 100}%` }"
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
                  {{ OPPORTUNITY_STATUS_LABEL[opp.status] }} ·
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
