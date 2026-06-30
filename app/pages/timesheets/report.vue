<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Timesheet Reports — Camel OS' })

const { can } = await usePermissions()
if (!can.value('timesheet', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

const today = new Date()
const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
const from = ref(monthStart)
const to = ref(today.toISOString().slice(0, 10))

interface Report {
  from: string
  to: string
  totalHours: number
  totalCost: number
  byUser: { name: string; hours: number; cost: number }[]
  byProject: { projectName: string; hours: number; cost: number }[]
}
const { data } = await useFetch<Report>('/api/hr/timesheets/report', {
  query: { from, to },
  key: 'ts-report',
  default: (): Report => ({
    from: from.value,
    to: to.value,
    totalHours: 0,
    totalCost: 0,
    byUser: [],
    byProject: [],
  }),
})
function csv() {
  const rows = [
    ['Project', 'Hours', 'Cost'],
    ...(data.value?.byProject ?? []).map((p) => [p.projectName, String(p.hours), String(p.cost)]),
  ]
  const blob = new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')], {
    type: 'text/csv',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `timesheet-report-${from.value}_${to.value}.csv`
  a.click()
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Timesheet Reports</h1>
        <p class="mt-1 text-sm text-muted">
          Cross-staff hours and cost-to-project from approved timesheets.
        </p>
      </div>
      <UButton
        to="/timesheets/approvals"
        variant="link"
        color="neutral"
        icon="i-lucide-arrow-left"
        label="Approvals"
      />
    </header>

    <div class="flex flex-wrap items-end gap-3">
      <UFormField label="From"><UInput v-model="from" type="date" /></UFormField>
      <UFormField label="To"><UInput v-model="to" type="date" /></UFormField>
      <UButton
        variant="outline"
        color="neutral"
        icon="i-lucide-download"
        label="CSV"
        class="ml-auto"
        @click="csv"
      />
    </div>

    <div class="grid grid-cols-2 gap-3">
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Total hours</p>
        <p class="mt-1 text-2xl font-semibold text-default">{{ data.totalHours }}</p>
      </div>
      <div class="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Total cost</p>
        <p class="mt-1 text-2xl font-semibold text-primary">
          {{ data.totalCost.toLocaleString() }}
        </p>
      </div>
    </div>

    <UCard>
      <template #header
        ><h3 class="text-sm font-semibold text-default">Cost to project (TS-05)</h3></template
      >
      <p v-if="!data.byProject.length" class="text-sm text-muted">
        No approved time in this range.
      </p>
      <table v-else class="w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="pb-2 font-medium">Project</th>
            <th class="pb-2 font-medium">Hours</th>
            <th class="pb-2 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="p in data.byProject" :key="p.projectName">
            <td class="py-1.5 text-default">{{ p.projectName }}</td>
            <td class="py-1.5 text-muted">{{ p.hours }}</td>
            <td class="py-1.5 text-right font-medium text-default">
              {{ p.cost.toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>

    <UCard>
      <template #header
        ><h3 class="text-sm font-semibold text-default">Hours by staff (TS-04)</h3></template
      >
      <p v-if="!data.byUser.length" class="text-sm text-muted">No approved time in this range.</p>
      <table v-else class="w-full text-sm">
        <thead class="text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="pb-2 font-medium">Staff</th>
            <th class="pb-2 font-medium">Hours</th>
            <th class="pb-2 text-right font-medium">Cost</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="u in data.byUser" :key="u.name">
            <td class="py-1.5 text-default">{{ u.name }}</td>
            <td class="py-1.5 text-muted">{{ u.hours }}</td>
            <td class="py-1.5 text-right font-medium text-default">
              {{ u.cost.toLocaleString() }}
            </td>
          </tr>
        </tbody>
      </table>
    </UCard>
  </div>
</template>
