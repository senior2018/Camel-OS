<script setup lang="ts">
import {
  DONOR_GRANT_STATUSES,
  DONOR_GRANT_STATUS_LABEL,
  type CreateGrantPayload,
  type DonorGrantStatus,
  type UpdateGrantPayload,
} from '@@/shared/schemas/client'
import type { DonorGrant } from '@/composables/useClient'

interface Props {
  grants: DonorGrant[]
  canEdit: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  create: [payload: CreateGrantPayload]
  update: [grantId: string, payload: UpdateGrantPayload]
  remove: [grantId: string]
}>()

const editing = ref<DonorGrant | null>(null)
const showForm = ref(false)

const form = reactive<{
  title: string
  startDate: string
  endDate: string
  totalValue: string
  currency: string
  reportingSchedule: string
  nextReportingDate: string
  status: DonorGrantStatus
  notes: string
}>({
  title: '',
  startDate: '',
  endDate: '',
  totalValue: '',
  currency: 'USD',
  reportingSchedule: '',
  nextReportingDate: '',
  status: 'pending',
  notes: '',
})

const statusOptions = DONOR_GRANT_STATUSES.map((s) => ({
  label: DONOR_GRANT_STATUS_LABEL[s],
  value: s,
}))

function openNew() {
  editing.value = null
  Object.assign(form, {
    title: '',
    startDate: '',
    endDate: '',
    totalValue: '',
    currency: 'USD',
    reportingSchedule: '',
    nextReportingDate: '',
    status: 'pending',
    notes: '',
  })
  showForm.value = true
}

function openEdit(g: DonorGrant) {
  editing.value = g
  Object.assign(form, {
    title: g.title,
    startDate: g.startDate ?? '',
    endDate: g.endDate ?? '',
    totalValue: g.totalValue ?? '',
    currency: g.currency,
    reportingSchedule: g.reportingSchedule ?? '',
    nextReportingDate: g.nextReportingDate ?? '',
    status: g.status,
    notes: g.notes ?? '',
  })
  showForm.value = true
}

function submit() {
  if (!form.title.trim()) return
  const payload = {
    title: form.title,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    totalValue: form.totalValue || null,
    currency: form.currency,
    reportingSchedule: form.reportingSchedule || null,
    nextReportingDate: form.nextReportingDate || null,
    status: form.status,
    notes: form.notes || null,
  }
  if (editing.value) emit('update', editing.value.id, payload)
  else emit('create', payload as CreateGrantPayload)
  showForm.value = false
}

function formatMoney(amount: string | null, currency: string): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return `${amount} ${currency}`
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}

function deadlineBadge(date: string | null): 'overdue' | 'soon' | 'later' | null {
  if (!date) return null
  const due = new Date(date).getTime()
  const now = Date.now()
  if (due < now) return 'overdue'
  const days = Math.floor((due - now) / 86_400_000)
  if (days <= 30) return 'soon'
  return 'later'
}

const totalsByCurrency = computed(() => {
  const acc: Record<string, number> = {}
  for (const g of props.grants) {
    if (!g.totalValue || g.status === 'cancelled') continue
    const n = Number(g.totalValue)
    if (Number.isNaN(n)) continue
    acc[g.currency] = (acc[g.currency] ?? 0) + n
  }
  return acc
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-default">Grants &amp; funding cycles</h3>
          <p v-if="grants.length" class="mt-0.5 text-xs text-muted">
            {{ grants.length }} grant{{ grants.length === 1 ? '' : 's' }}
            <template v-if="Object.keys(totalsByCurrency).length">
              · Total
              <span
                v-for="(amt, ccy, i) in totalsByCurrency"
                :key="ccy"
                class="font-medium text-default"
              >
                <span v-if="i > 0">, </span>{{ formatMoney(String(amt), ccy) }}
              </span>
            </template>
          </p>
        </div>
        <UButton
          v-if="canEdit"
          size="xs"
          variant="outline"
          icon="i-lucide-plus"
          label="New grant"
          @click="openNew"
        />
      </div>
    </template>

    <div
      v-if="!grants.length"
      class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      No grants recorded yet.
    </div>

    <ul v-else class="divide-y divide-default">
      <li v-for="g in grants" :key="g.id" class="space-y-2 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <p class="flex-1 text-sm font-medium text-default">{{ g.title }}</p>
          <UBadge
            variant="subtle"
            :color="
              g.status === 'active'
                ? 'success'
                : g.status === 'completed'
                  ? 'neutral'
                  : g.status === 'cancelled'
                    ? 'error'
                    : 'warning'
            "
            size="xs"
            :label="DONOR_GRANT_STATUS_LABEL[g.status]"
          />
          <div v-if="canEdit" class="flex items-center gap-1">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit"
              @click="openEdit(g)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Delete"
              @click="emit('remove', g.id)"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
          <div>
            <span class="font-medium text-default">Cycle:</span>
            {{ g.startDate || '—' }} → {{ g.endDate || '—' }}
            <UBadge
              v-if="deadlineBadge(g.endDate) === 'overdue'"
              color="error"
              variant="subtle"
              size="xs"
              label="Overdue"
              class="ml-1"
            />
            <UBadge
              v-else-if="deadlineBadge(g.endDate) === 'soon'"
              color="warning"
              variant="subtle"
              size="xs"
              label="≤30 days"
              class="ml-1"
            />
          </div>
          <div>
            <span class="font-medium text-default">Value:</span>
            {{ formatMoney(g.totalValue, g.currency) }}
          </div>
          <div v-if="g.reportingSchedule">
            <span class="font-medium text-default">Reporting:</span> {{ g.reportingSchedule }}
          </div>
          <div v-if="g.nextReportingDate">
            <span class="font-medium text-default">Next report:</span> {{ g.nextReportingDate }}
            <UBadge
              v-if="deadlineBadge(g.nextReportingDate) === 'overdue'"
              color="error"
              variant="subtle"
              size="xs"
              label="Overdue"
              class="ml-1"
            />
            <UBadge
              v-else-if="deadlineBadge(g.nextReportingDate) === 'soon'"
              color="warning"
              variant="subtle"
              size="xs"
              label="≤30 days"
              class="ml-1"
            />
          </div>
        </div>

        <p v-if="g.notes" class="whitespace-pre-wrap text-xs text-muted">{{ g.notes }}</p>
      </li>
    </ul>

    <UModal v-model:open="showForm" :title="editing ? 'Edit grant' : 'New grant'">
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="Title" required class="sm:col-span-2">
            <UInput
              v-model="form.title"
              placeholder="e.g. Health Outcomes Cycle 3"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Start date">
            <UInput v-model="form.startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="End date">
            <UInput v-model="form.endDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Total value">
            <UInput v-model="form.totalValue" type="number" placeholder="0" class="w-full" />
          </UFormField>
          <UFormField label="Currency">
            <UInput v-model="form.currency" maxlength="3" class="w-full" />
          </UFormField>
          <UFormField label="Status">
            <USelectMenu
              v-model="form.status"
              :items="statusOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Next reporting date">
            <UInput v-model="form.nextReportingDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Reporting schedule" class="sm:col-span-2">
            <UInput
              v-model="form.reportingSchedule"
              placeholder="Quarterly, due 30 days after period end"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Notes" class="sm:col-span-2">
            <UTextarea v-model="form.notes" :rows="3" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showForm = false" />
          <UButton :label="editing ? 'Save' : 'Add'" @click="submit" />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
