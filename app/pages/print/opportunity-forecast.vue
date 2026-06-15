<script setup lang="ts">
import { OPPORTUNITY_STATUS_LABEL, type OpportunityStatus } from '@@/shared/schemas/opportunity'

// OM-06 — print/PDF view of the opportunity weighted forecast. No dashboard
// chrome; opens the browser print dialog (Save as PDF).
definePageMeta({ layout: false })

interface ForecastOpp {
  id: string
  title: string
  status: OpportunityStatus
  winProbability: number | null
  estimatedValue: string | null
  currency: string
}

const { data } = await useFetch<{ items: ForecastOpp[] }>('/api/opportunities', {
  key: 'print-opportunity-forecast',
  default: () => ({ items: [] }),
})

function valueOf(o: ForecastOpp): number {
  const n = Number(o.estimatedValue)
  return o.estimatedValue && !Number.isNaN(n) ? n : 0
}
function weightedOf(o: ForecastOpp): number {
  if (o.status === 'rejected') return 0
  return (valueOf(o) * (o.winProbability ?? 0)) / 100
}
const rows = computed(() =>
  (data.value?.items ?? [])
    .filter((o) => o.status !== 'rejected')
    .sort((a, b) => weightedOf(b) - weightedOf(a))
)
const weightedTotal = computed(() => rows.value.reduce((s, o) => s + weightedOf(o), 0))
const openValue = computed(() => rows.value.reduce((s, o) => s + valueOf(o), 0))

function money(n: number): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: 0 })
}
const generatedAt = new Date().toLocaleDateString(undefined, {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
})

useHead({ title: 'Opportunity forecast (print)' })
function doPrint() {
  window.print()
}
onMounted(() => setTimeout(doPrint, 400))
</script>

<template>
  <div class="mx-auto max-w-4xl p-10 text-[13px] leading-relaxed text-black">
    <div class="no-print mb-6 flex justify-end">
      <button class="rounded border px-3 py-1 text-sm" @click="doPrint">Print / Save PDF</button>
    </div>

    <header class="mb-6 border-b-2 border-black pb-4">
      <p class="text-xs uppercase tracking-widest text-gray-500">Opportunity Management</p>
      <h1 class="mt-1 text-2xl font-bold">Weighted Forecast</h1>
      <p class="mt-2 text-gray-700">
        Weighted pipeline <strong>{{ money(weightedTotal) }}</strong> of {{ money(openValue) }} open
        value · {{ rows.length }} open opportunities
      </p>
    </header>

    <table class="w-full border-collapse text-left">
      <thead>
        <tr class="border-b border-black">
          <th class="py-1.5">Opportunity</th>
          <th class="py-1.5">Status</th>
          <th class="py-1.5 text-right">Value</th>
          <th class="py-1.5 text-right">Win %</th>
          <th class="py-1.5 text-right">Weighted</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in rows" :key="o.id" class="border-b border-gray-300">
          <td class="py-1.5">{{ o.title }}</td>
          <td class="py-1.5">{{ OPPORTUNITY_STATUS_LABEL[o.status] }}</td>
          <td class="py-1.5 text-right">{{ money(valueOf(o)) }} {{ o.currency }}</td>
          <td class="py-1.5 text-right">
            {{ o.winProbability === null ? '—' : `${o.winProbability}%` }}
          </td>
          <td class="py-1.5 text-right font-medium">{{ money(weightedOf(o)) }}</td>
        </tr>
        <tr v-if="!rows.length">
          <td colspan="5" class="py-3 text-center italic text-gray-500">No open opportunities.</td>
        </tr>
      </tbody>
    </table>

    <footer class="mt-8 border-t pt-3 text-xs text-gray-500">
      Generated {{ generatedAt }} · Camel OS
    </footer>
  </div>
</template>

<style scoped>
@media print {
  .no-print {
    display: none;
  }
}
@page {
  size: A4;
  margin: 16mm;
}
</style>
