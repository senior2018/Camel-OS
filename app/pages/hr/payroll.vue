<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Payroll — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'admin')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}

const now = new Date()
const month = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

interface Row {
  userId: string
  name: string
  employeeNumber: string | null
  jobTitle: string | null
  currency: string
  baseSalary: number
  unpaidDays: number
  deduction: number
  net: number
}
const { data } = await useFetch<{
  month: string
  workingDaysInMonth: number
  rows: Row[]
  totalNet: number
}>('/api/hr/payroll', {
  query: { month },
  key: 'payroll',
  default: () => ({ month: month.value, workingDaysInMonth: 0, rows: [], totalNet: 0 }),
})
function money(v: number, cur: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: cur || 'USD',
    maximumFractionDigits: 0,
  }).format(v)
}
function csv() {
  const header = [
    'Employee #',
    'Name',
    'Job title',
    'Currency',
    'Base',
    'Unpaid days',
    'Deduction',
    'Net',
  ]
  const rows = [
    header,
    ...(data.value?.rows ?? []).map((r) => [
      r.employeeNumber ?? '',
      r.name,
      r.jobTitle ?? '',
      r.currency,
      String(r.baseSalary),
      String(r.unpaidDays),
      String(r.deduction),
      String(r.net),
    ]),
  ]
  const blob = new Blob([rows.map((r) => r.map((c) => `"${c}"`).join(',')).join('\n')], {
    type: 'text/csv',
  })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `payroll-${month.value}.csv`
  a.click()
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Payroll</h1>
        <p class="mt-1 text-sm text-muted">
          Payroll-ready run · {{ data.workingDaysInMonth }} working days in month.
        </p>
      </div>
      <div class="flex items-end gap-2">
        <UFormField label="Month"><UInput v-model="month" type="month" /></UFormField>
        <UButton
          variant="outline"
          color="neutral"
          icon="i-lucide-download"
          label="CSV"
          @click="csv"
        />
        <UButton
          to="/hr"
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="People"
        />
      </div>
    </header>

    <p
      v-if="!data.rows.length"
      class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
    >
      No employees with a personnel file.
    </p>
    <div v-else class="overflow-x-auto rounded-xl border border-default bg-default shadow-sm">
      <table class="w-full text-sm">
        <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Employee</th>
            <th class="px-4 py-2 font-medium">Base</th>
            <th class="px-4 py-2 font-medium">Unpaid days</th>
            <th class="px-4 py-2 font-medium">Deduction</th>
            <th class="px-4 py-2 text-right font-medium">Net</th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="r in data.rows" :key="r.userId">
            <td class="px-4 py-2.5">
              <div class="font-medium text-default">{{ r.name }}</div>
              <div class="text-xs text-muted">
                {{ [r.employeeNumber, r.jobTitle].filter(Boolean).join(' · ') || '—' }}
              </div>
            </td>
            <td class="px-4 py-2.5 text-muted">{{ money(r.baseSalary, r.currency) }}</td>
            <td class="px-4 py-2.5 text-muted">{{ r.unpaidDays }}</td>
            <td class="px-4 py-2.5 text-muted">
              {{ r.deduction ? `−${money(r.deduction, r.currency)}` : '—' }}
            </td>
            <td class="px-4 py-2.5 text-right font-semibold text-default">
              {{ money(r.net, r.currency) }}
            </td>
          </tr>
        </tbody>
        <tfoot class="border-t border-default bg-elevated/30">
          <tr>
            <td class="px-4 py-2 text-xs uppercase text-muted" colspan="4">Total net</td>
            <td class="px-4 py-2 text-right font-semibold text-default">
              {{ data.totalNet.toLocaleString() }}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
    <p class="text-xs text-muted">
      Deductions reflect approved unpaid leave only. Net = base − (base ÷ working days × unpaid
      days).
    </p>
  </div>
</template>
