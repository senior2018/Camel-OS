<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Win / Loss Report — Camel OS' })

const { can } = await usePermissions()
if (!can.value('proposal', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

interface Row {
  key: string
  won: number
  lost: number
  winRate: number | null
}
interface Report {
  overall: { won: number; lost: number; winRate: number | null; total: number }
  bySector: Row[]
  byClient: Row[]
  byTeam: Row[]
}

const from = ref('')
const to = ref('')
const query = computed(() => {
  const p = new URLSearchParams()
  if (from.value) p.set('from', from.value)
  if (to.value) p.set('to', to.value)
  const s = p.toString()
  return s ? `?${s}` : ''
})
const { data, status, refresh } = await useFetch<Report>(
  () => `/api/reports/win-loss${query.value}`,
  {
    key: 'win-loss-report',
  }
)

function rateColor(r: number | null): 'success' | 'warning' | 'error' | 'neutral' {
  if (r === null) return 'neutral'
  if (r >= 60) return 'success'
  if (r >= 40) return 'warning'
  return 'error'
}
function doPrint() {
  window.print()
}
</script>

<template>
  <div class="space-y-6 print:space-y-4">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Proposals"
          size="xs"
          class="print:hidden"
          @click="navigateTo('/proposals')"
        />
        <h1 class="mt-1 text-2xl font-semibold tracking-tight text-default">Win / Loss Report</h1>
      </div>
      <div class="flex flex-wrap items-end gap-2 print:hidden">
        <UFormField label="From" size="xs">
          <UInput v-model="from" type="date" size="sm" @change="() => refresh()" />
        </UFormField>
        <UFormField label="To" size="xs">
          <UInput v-model="to" type="date" size="sm" @change="() => refresh()" />
        </UFormField>
        <UButton
          variant="outline"
          icon="i-lucide-printer"
          label="Print / PDF"
          size="sm"
          @click="doPrint"
        />
      </div>
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else-if="data">
      <!-- Overall -->
      <div class="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Decided</p>
          <p class="mt-1 text-2xl font-semibold text-default">{{ data.overall.total }}</p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Won</p>
          <p class="mt-1 text-2xl font-semibold text-success">{{ data.overall.won }}</p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Lost</p>
          <p class="mt-1 text-2xl font-semibold text-error">{{ data.overall.lost }}</p>
        </div>
        <div class="rounded-xl border border-default p-4">
          <p class="text-xs uppercase tracking-wide text-muted">Win rate</p>
          <p class="mt-1 text-2xl font-semibold text-default">
            {{ data.overall.winRate === null ? '—' : `${data.overall.winRate}%` }}
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <UCard
          v-for="grp in [
            { title: 'By sector', rows: data.bySector },
            { title: 'By client', rows: data.byClient },
            { title: 'By team (Lead)', rows: data.byTeam },
          ]"
          :key="grp.title"
        >
          <template #header>
            <h3 class="text-sm font-semibold text-default">{{ grp.title }}</h3>
          </template>
          <table class="w-full text-sm">
            <thead>
              <tr class="text-left text-xs text-muted">
                <th class="pb-2">Name</th>
                <th class="pb-2 text-center">W</th>
                <th class="pb-2 text-center">L</th>
                <th class="pb-2 text-right">Rate</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="r in grp.rows" :key="r.key">
                <td class="py-1.5 text-default">{{ r.key }}</td>
                <td class="py-1.5 text-center text-success">{{ r.won }}</td>
                <td class="py-1.5 text-center text-error">{{ r.lost }}</td>
                <td class="py-1.5 text-right">
                  <UBadge :color="rateColor(r.winRate)" variant="subtle" size="xs">
                    {{ r.winRate === null ? '—' : `${r.winRate}%` }}
                  </UBadge>
                </td>
              </tr>
              <tr v-if="!grp.rows.length">
                <td colspan="4" class="py-3 text-center text-muted">No data.</td>
              </tr>
            </tbody>
          </table>
        </UCard>
      </div>
    </template>
  </div>
</template>
