<script setup lang="ts">
import {
  EXPENSE_CLAIM_STATUS_COLOR,
  EXPENSE_CLAIM_STATUS_LABEL,
  type ExpenseClaimStatus,
} from '@@/shared/schemas/finance'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'My Expenses — Camel OS' })
const toast = useToast()

interface Claim {
  id: string
  title: string
  category: string | null
  amount: string
  currency: string
  incurredDate: string
  status: ExpenseClaimStatus
  projectName: string | null
  decisionNote: string | null
}
const { data, refresh } = await useFetch<{ items: Claim[] }>('/api/finance/expense-claims', {
  key: 'my-expense-claims',
  default: () => ({ items: [] }),
})

const busy = ref(false)
const open = ref(false)
const form = reactive({
  title: '',
  category: '',
  amount: null as number | null,
  currency: 'USD',
  incurredDate: new Date().toISOString().slice(0, 10),
  receiptUrl: '',
})
async function create() {
  if (!form.title.trim() || form.amount == null) return
  busy.value = true
  try {
    await $fetch('/api/finance/expense-claims', {
      method: 'POST',
      body: {
        title: form.title,
        category: form.category || null,
        amount: form.amount,
        currency: form.currency || 'USD',
        incurredDate: form.incurredDate,
        receiptUrl: form.receiptUrl || '',
      },
    })
    toast.add({ title: 'Claim saved as draft', color: 'success' })
    open.value = false
    Object.assign(form, { title: '', category: '', amount: null, receiptUrl: '' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    busy.value = false
  }
}
async function submit(c: Claim) {
  if (busy.value) return
  busy.value = true
  try {
    await $fetch(`/api/finance/expense-claims/${c.id}`, {
      method: 'PATCH',
      body: { action: 'submit' },
    })
    toast.add({ title: 'Submitted for approval', color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not submit', description: msg, color: 'error' })
  } finally {
    busy.value = false
  }
}
function money(v: string, cur: string) {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: cur,
    maximumFractionDigits: 0,
  }).format(Number(v))
}
function fdate(s: string) {
  return new Date(s).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-6">
    <header
      class="flex flex-col gap-3 border-b border-default/70 pb-5 sm:flex-row sm:items-end sm:justify-between"
    >
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">My Expenses</h1>
        <p class="mt-1 text-sm text-muted">
          File expense claims and track their approval and payment.
        </p>
      </div>
      <UButton icon="i-lucide-plus" label="New claim" @click="open = true" />
    </header>

    <div
      v-if="!data?.items.length"
      class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
    >
      No claims yet. Click <strong>New claim</strong> to file one.
    </div>
    <div v-else class="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <UCard v-for="c in data.items" :key="c.id">
        <div class="flex items-start justify-between gap-2">
          <div class="min-w-0">
            <p class="font-medium text-default">{{ c.title }}</p>
            <p class="text-xs text-muted">
              {{ fdate(c.incurredDate) }}<span v-if="c.category"> · {{ c.category }}</span>
            </p>
          </div>
          <UBadge
            :color="EXPENSE_CLAIM_STATUS_COLOR[c.status]"
            variant="subtle"
            size="xs"
            :label="EXPENSE_CLAIM_STATUS_LABEL[c.status]"
          />
        </div>
        <div class="mt-2 flex items-center justify-between">
          <span class="text-lg font-semibold text-default">{{ money(c.amount, c.currency) }}</span>
          <UButton
            v-if="c.status === 'draft'"
            size="xs"
            label="Submit"
            :loading="busy"
            @click="submit(c)"
          />
        </div>
        <p v-if="c.decisionNote" class="mt-1 text-xs text-muted">Note: {{ c.decisionNote }}</p>
      </UCard>
    </div>

    <UModal v-model:open="open" title="New expense claim">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Title" required
            ><UInput
              v-model="form.title"
              placeholder="e.g. Client meeting travel"
              class="w-full"
              autofocus
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Amount"
              ><UInputNumber v-model="form.amount" :min="0" class="w-full"
            /></UFormField>
            <UFormField label="Currency"
              ><UInput v-model="form.currency" maxlength="3" class="w-full"
            /></UFormField>
          </div>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Category"
              ><UInput v-model="form.category" placeholder="e.g. Travel" class="w-full"
            /></UFormField>
            <UFormField label="Date"
              ><UInput v-model="form.incurredDate" type="date" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Receipt URL"
            ><UInput v-model="form.receiptUrl" placeholder="https://…" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" />
          <UButton label="Save draft" :loading="busy" @click="create" />
        </div>
      </template>
    </UModal>
  </div>
</template>
