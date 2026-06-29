<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Engagement Report — Camel OS' })

const { can } = await usePermissions()
if (
  !(
    can.value('communications', 'update') ||
    can.value('communications', 'approve') ||
    can.value('communications', 'create')
  )
) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

interface Row {
  id: string
  stakeholderName: string
  activityDate: string
  type: string
  outcome: string | null
}
interface Report {
  activities: Row[]
  summary: {
    stakeholdersEngaged: number
    totalActivities: number
    byType: { type: string; count: number }[]
  }
}

const from = ref('')
const to = ref('')
const query = computed(() => ({ from: from.value || undefined, to: to.value || undefined }))
const { data } = await useFetch<Report>('/api/communications/stakeholders/report', {
  query,
  key: 'engagement-report',
})

function fdate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
function exportCsv() {
  const rows = [
    ['Stakeholder', 'Date', 'Type', 'Outcome'],
    ...(data.value?.activities ?? []).map((a) => [
      a.stakeholderName,
      a.activityDate,
      a.type,
      (a.outcome ?? '').replace(/[\n,]/g, ' '),
    ]),
  ]
  const csv = rows.map((r) => r.join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'engagement-report.csv'
  a.click()
  URL.revokeObjectURL(url)
}
function printReport() {
  if (import.meta.client) window.print()
}
</script>

<template>
  <div class="space-y-6">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Stakeholders"
          class="-ml-2"
          @click="navigateTo('/stakeholders')"
        />
        <h1 class="text-2xl font-semibold tracking-tight text-default">Engagement Report</h1>
        <p class="mt-1 text-sm text-muted">Stakeholders engaged and activities logged by period.</p>
      </div>
      <div class="flex flex-wrap items-end gap-2">
        <UFormField label="From" size="xs"
          ><UInput v-model="from" type="date" size="sm"
        /></UFormField>
        <UFormField label="To" size="xs"><UInput v-model="to" type="date" size="sm" /></UFormField>
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-download"
          label="Export CSV"
          @click="exportCsv"
        />
        <UButton
          variant="outline"
          color="neutral"
          size="sm"
          icon="i-lucide-printer"
          label="Print"
          @click="printReport"
        />
      </div>
    </header>

    <div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
      <div class="rounded-xl border border-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Stakeholders engaged</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ data?.summary.stakeholdersEngaged ?? 0 }}
        </p>
      </div>
      <div class="rounded-xl border border-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Activities logged</p>
        <p class="mt-1 text-2xl font-semibold text-primary">
          {{ data?.summary.totalActivities ?? 0 }}
        </p>
      </div>
      <div class="rounded-xl border border-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Activity types</p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ data?.summary.byType.length ?? 0 }}
        </p>
      </div>
    </div>

    <UCard v-if="data?.summary.byType.length">
      <template #header
        ><h3 class="text-sm font-semibold text-default">By activity type</h3></template
      >
      <div class="flex flex-wrap gap-2">
        <UBadge v-for="t in data.summary.byType" :key="t.type" variant="subtle" color="neutral">
          {{ t.type }} · {{ t.count }}
        </UBadge>
      </div>
    </UCard>

    <div class="overflow-hidden rounded-xl border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Stakeholder</th>
            <th class="px-4 py-2 font-medium">Date</th>
            <th class="px-4 py-2 font-medium">Type</th>
            <th class="hidden px-4 py-2 font-medium sm:table-cell">Outcome</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="a in data?.activities ?? []" :key="a.id">
            <td class="px-4 py-2.5 font-medium text-default">{{ a.stakeholderName }}</td>
            <td class="px-4 py-2.5 text-muted">{{ fdate(a.activityDate) }}</td>
            <td class="px-4 py-2.5">
              <UBadge variant="subtle" color="neutral" size="xs" :label="a.type" />
            </td>
            <td class="hidden px-4 py-2.5 text-muted sm:table-cell">{{ a.outcome || '—' }}</td>
          </tr>
          <tr v-if="!data?.activities.length">
            <td colspan="4" class="px-4 py-8 text-center text-sm text-muted">
              No activities in this period.
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>
