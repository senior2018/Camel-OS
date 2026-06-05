<script setup lang="ts">
import { CLIENT_INTERACTION_TYPE_LABEL } from '@@/shared/schemas/client'
import type { ClientInteractionType } from '@@/shared/schemas/client'

definePageMeta({
  layout: 'dashboard',
})

const { can } = await usePermissions()
if (!can.value('crm', 'read')) {
  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have permission to view CRM reports.',
    fatal: true,
  })
}

useHead({ title: 'CRM Activity Report — Camel OS' })

// Default the date range to the current month for a sensible "open and see
// useful data" experience. Both bounds are inclusive (the server adds a day).
const today = new Date()
const firstOfMonth = new Date(today.getFullYear(), today.getMonth(), 1)
function iso(d: Date): string {
  return d.toISOString().slice(0, 10)
}

const from = ref(iso(firstOfMonth))
const to = ref(iso(today))
const userId = ref<string | null>(null)

interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
}
const { data: teamData } = await useFetch<{ members: TeamMember[] }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})
const userOptions = computed(() => [
  { label: 'Everyone', value: null as string | null },
  ...(teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id as string | null,
  })),
])

interface ReportResponse {
  filters: { from: string; to: string; userId?: string | null }
  totals: { contactsReached: number; meetingsHeld: number; interactionsLogged: number }
  pipelineValueByCurrency: Record<string, number>
  byInteractionType: Array<{ type: ClientInteractionType; count: number }>
  byUser: Array<{
    userId: string
    userName: string
    interactionsLogged: number
    meetingsHeld: number
  }>
}

const query = computed(() => {
  const q = new URLSearchParams({ from: from.value, to: to.value })
  if (userId.value) q.set('userId', userId.value)
  return q.toString()
})

const { data, status, refresh } = useFetch<ReportResponse>(
  () => `/api/reports/crm-activity?${query.value}`,
  { key: 'crm-activity-report', watch: [query] }
)

function downloadCsv() {
  // window.location triggers a real browser download with the auth cookie.
  window.location.href = `/api/reports/crm-activity.csv?${query.value}`
}

function print() {
  window.print()
}

function formatMoney(amount: number, currency: string): string {
  return `${amount.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}
</script>

<template>
  <div class="space-y-6">
    <header class="space-y-3 print:space-y-1">
      <div>
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Back to Customer Management"
          size="xs"
          class="print:hidden"
          @click="navigateTo('/clients')"
        />
        <h1 class="mt-2 text-2xl font-semibold tracking-tight text-default">CRM Activity Report</h1>
        <p class="mt-1 text-sm text-muted">
          Interactions logged, meetings held, and pipeline movement by date range and staff member.
        </p>
      </div>

      <div class="flex flex-wrap items-end gap-3 print:hidden">
        <UFormField label="From">
          <UInput v-model="from" type="date" size="md" />
        </UFormField>
        <UFormField label="To">
          <UInput v-model="to" type="date" size="md" />
        </UFormField>
        <UFormField label="Staff member" class="min-w-50">
          <USelectMenu v-model="userId" :items="userOptions" value-key="value" class="w-full" />
        </UFormField>

        <div class="ml-auto flex items-end gap-2">
          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-refresh-cw"
            label="Refresh"
            @click="() => refresh()"
          />
          <UButton
            variant="outline"
            color="neutral"
            icon="i-lucide-download"
            label="Export CSV"
            @click="downloadCsv"
          />
          <UButton icon="i-lucide-printer" label="Print" @click="print" />
        </div>
      </div>
    </header>

    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <template v-else-if="data">
      <p class="text-xs uppercase tracking-wide text-muted">
        Period: {{ data.filters.from }} → {{ data.filters.to }}
        <span v-if="data.filters.userId"> · filtered to selected staff member</span>
      </p>

      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">Contacts reached</p>
          <p class="mt-1 text-3xl font-semibold text-default">{{ data.totals.contactsReached }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">Meetings held</p>
          <p class="mt-1 text-3xl font-semibold text-default">{{ data.totals.meetingsHeld }}</p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">Interactions logged</p>
          <p class="mt-1 text-3xl font-semibold text-default">
            {{ data.totals.interactionsLogged }}
          </p>
        </UCard>
        <UCard>
          <p class="text-xs uppercase tracking-wide text-muted">Pipeline value</p>
          <div class="mt-1 space-y-0.5">
            <p
              v-for="(amt, ccy) in data.pipelineValueByCurrency"
              :key="ccy"
              class="text-xl font-semibold text-default"
            >
              {{ formatMoney(amt, String(ccy)) }}
            </p>
            <p
              v-if="!Object.keys(data.pipelineValueByCurrency).length"
              class="text-xl font-semibold text-muted"
            >
              —
            </p>
          </div>
        </UCard>
      </div>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold text-default">By interaction type</h3>
          </template>
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="py-2">Type</th>
                <th class="py-2 text-right">Count</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="r in data.byInteractionType" :key="r.type">
                <td class="py-2 text-default">{{ CLIENT_INTERACTION_TYPE_LABEL[r.type] }}</td>
                <td class="py-2 text-right text-default">{{ r.count }}</td>
              </tr>
              <tr v-if="!data.byInteractionType.length">
                <td colspan="2" class="py-4 text-center text-muted">No interactions in range.</td>
              </tr>
            </tbody>
          </table>
        </UCard>

        <UCard>
          <template #header>
            <h3 class="text-sm font-semibold text-default">By staff member</h3>
          </template>
          <table v-if="data.byUser.length" class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="py-2">Staff</th>
                <th class="py-2 text-right">Interactions</th>
                <th class="py-2 text-right">Meetings</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="r in data.byUser" :key="r.userId">
                <td class="py-2 text-default">{{ r.userName }}</td>
                <td class="py-2 text-right text-default">{{ r.interactionsLogged }}</td>
                <td class="py-2 text-right text-default">{{ r.meetingsHeld }}</td>
              </tr>
            </tbody>
          </table>
          <p v-else class="py-4 text-center text-sm text-muted">
            Filtered to a single user — see headline totals.
          </p>
        </UCard>
      </div>
    </template>
  </div>
</template>

<style scoped>
@media print {
  :global(aside),
  :global(header.sticky) {
    display: none !important;
  }
  :global(main) {
    padding: 0 !important;
  }
  :global(.lg\:pl-64) {
    padding-left: 0 !important;
  }
}
</style>
