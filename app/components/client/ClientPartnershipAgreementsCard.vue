<script setup lang="ts">
import {
  PARTNERSHIP_AGREEMENT_STATUSES,
  PARTNERSHIP_AGREEMENT_STATUS_LABEL,
  type CreateAgreementPayload,
  type PartnershipAgreementStatus,
  type UpdateAgreementPayload,
} from '@@/shared/schemas/partnership'
import type { PartnershipAgreement } from '@/composables/useClient'

interface Props {
  agreements: PartnershipAgreement[]
  canEdit: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  create: [payload: CreateAgreementPayload]
  update: [agreementId: string, payload: UpdateAgreementPayload]
  remove: [agreementId: string]
}>()

const editing = ref<PartnershipAgreement | null>(null)
const showForm = ref(false)

const form = reactive<{
  title: string
  startDate: string
  endDate: string
  value: string
  currency: string
  status: PartnershipAgreementStatus
  documentUrl: string
  notes: string
}>({
  title: '',
  startDate: '',
  endDate: '',
  value: '',
  currency: 'USD',
  status: 'draft',
  documentUrl: '',
  notes: '',
})

const statusOptions = PARTNERSHIP_AGREEMENT_STATUSES.map((s) => ({
  label: PARTNERSHIP_AGREEMENT_STATUS_LABEL[s],
  value: s,
}))

function openNew() {
  editing.value = null
  Object.assign(form, {
    title: '',
    startDate: '',
    endDate: '',
    value: '',
    currency: 'USD',
    status: 'draft',
    documentUrl: '',
    notes: '',
  })
  showForm.value = true
}

function openEdit(a: PartnershipAgreement) {
  editing.value = a
  Object.assign(form, {
    title: a.title,
    startDate: a.startDate ?? '',
    endDate: a.endDate ?? '',
    value: a.value ?? '',
    currency: a.currency,
    status: a.status,
    documentUrl: a.documentUrl ?? '',
    notes: a.notes ?? '',
  })
  showForm.value = true
}

function submit() {
  if (!form.title.trim()) return
  const payload = {
    title: form.title,
    startDate: form.startDate || null,
    endDate: form.endDate || null,
    value: form.value || null,
    currency: form.currency,
    status: form.status,
    documentUrl: form.documentUrl || null,
    notes: form.notes || null,
  }
  if (editing.value) emit('update', editing.value.id, payload)
  else emit('create', payload as CreateAgreementPayload)
  showForm.value = false
}

function formatMoney(amount: string | null, currency: string): string {
  if (!amount) return '—'
  const n = Number(amount)
  if (Number.isNaN(n)) return `${amount} ${currency}`
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}

// CR-11 — three windows: overdue, renewal-due (≤90d), comfortable (>90d).
function renewalBadge(date: string | null): 'overdue' | 'renew-soon' | 'renew-90' | null {
  if (!date) return null
  const due = new Date(date).getTime()
  const now = Date.now()
  if (due < now) return 'overdue'
  const days = Math.floor((due - now) / 86_400_000)
  if (days <= 30) return 'renew-soon'
  if (days <= 90) return 'renew-90'
  return null
}

const totalsByCurrency = computed(() => {
  const acc: Record<string, number> = {}
  for (const a of props.agreements) {
    if (!a.value || a.status === 'terminated' || a.status === 'expired') continue
    const n = Number(a.value)
    if (Number.isNaN(n)) continue
    acc[a.currency] = (acc[a.currency] ?? 0) + n
  }
  return acc
})
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 class="text-sm font-semibold text-default">Partnership agreements</h3>
          <p v-if="agreements.length" class="mt-0.5 text-xs text-muted">
            {{ agreements.length }} agreement{{ agreements.length === 1 ? '' : 's' }}
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
          label="New agreement"
          @click="openNew"
        />
      </div>
    </template>

    <div
      v-if="!agreements.length"
      class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      No partnership agreements recorded yet.
    </div>

    <ul v-else class="divide-y divide-default">
      <li v-for="a in agreements" :key="a.id" class="space-y-2 py-3">
        <div class="flex flex-wrap items-center gap-2">
          <p class="flex-1 text-sm font-medium text-default">{{ a.title }}</p>
          <UBadge
            variant="subtle"
            :color="
              a.status === 'active'
                ? 'success'
                : a.status === 'expired'
                  ? 'error'
                  : a.status === 'terminated'
                    ? 'neutral'
                    : 'warning'
            "
            size="xs"
            :label="PARTNERSHIP_AGREEMENT_STATUS_LABEL[a.status]"
          />
          <div v-if="canEdit" class="flex items-center gap-1">
            <UButton
              size="xs"
              variant="ghost"
              icon="i-lucide-pencil"
              aria-label="Edit"
              @click="openEdit(a)"
            />
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Delete"
              @click="emit('remove', a.id)"
            />
          </div>
        </div>

        <div class="grid grid-cols-1 gap-2 text-xs text-muted sm:grid-cols-2">
          <div>
            <span class="font-medium text-default">Term:</span>
            {{ a.startDate || '—' }} → {{ a.endDate || '—' }}
            <UBadge
              v-if="renewalBadge(a.endDate) === 'overdue'"
              color="error"
              variant="subtle"
              size="xs"
              label="Expired"
              class="ml-1"
            />
            <UBadge
              v-else-if="renewalBadge(a.endDate) === 'renew-soon'"
              color="warning"
              variant="subtle"
              size="xs"
              label="≤30 days"
              class="ml-1"
            />
            <UBadge
              v-else-if="renewalBadge(a.endDate) === 'renew-90'"
              color="primary"
              variant="subtle"
              size="xs"
              label="≤90 days"
              class="ml-1"
            />
          </div>
          <div>
            <span class="font-medium text-default">Value:</span>
            {{ formatMoney(a.value, a.currency) }}
          </div>
          <div v-if="a.documentUrl" class="sm:col-span-2">
            <span class="font-medium text-default">Document:</span>
            <a
              :href="a.documentUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary hover:underline"
              >Open</a
            >
          </div>
        </div>

        <p v-if="a.notes" class="whitespace-pre-wrap text-xs text-muted">{{ a.notes }}</p>
      </li>
    </ul>

    <UModal v-model:open="showForm" :title="editing ? 'Edit agreement' : 'New agreement'">
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="Title" required class="sm:col-span-2">
            <UInput v-model="form.title" placeholder="e.g. MOU 2026–2028" class="w-full" />
          </UFormField>
          <UFormField label="Start date">
            <UInput v-model="form.startDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="End date" hint="Renewal reminders fire 90 + 30 days before this date.">
            <UInput v-model="form.endDate" type="date" class="w-full" />
          </UFormField>
          <UFormField label="Value">
            <UInput v-model="form.value" type="number" placeholder="0" class="w-full" />
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
          <UFormField label="Document URL" class="sm:col-span-2">
            <UInput
              v-model="form.documentUrl"
              placeholder="https://drive.google.com/..."
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
