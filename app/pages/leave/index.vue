<script setup lang="ts">
import {
  LEAVE_STATUS_COLOR,
  LEAVE_STATUS_LABEL,
  LEAVE_TYPE_LABEL,
  LEAVE_TYPES,
  leaveRequestSchema,
  type LeaveStatus,
  type LeaveType,
} from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'My Leave — Camel OS' })

interface Req {
  id: string
  type: LeaveType
  startDate: string
  endDate: string
  days: string
  reason: string | null
  status: LeaveStatus
  decisionNote: string | null
}
interface Balance {
  entitlement: number
  used: number
  pending: number
  remaining: number
  year: number
}
const { data, refresh } = await useFetch<{ requests: Req[]; balance: Balance }>('/api/leave', {
  key: 'my-leave',
  default: () => ({
    requests: [],
    balance: {
      entitlement: 21,
      used: 0,
      pending: 0,
      remaining: 21,
      year: new Date().getFullYear(),
    },
  }),
})

const toast = useToast()
const open = ref(false)
const saving = ref(false)
const form = reactive({ type: 'annual' as LeaveType, startDate: '', endDate: '', reason: '' })
const typeItems = LEAVE_TYPES.map((t) => ({ label: LEAVE_TYPE_LABEL[t], value: t as string }))

async function submit() {
  const parsed = leaveRequestSchema.safeParse({ ...form, reason: form.reason || null })
  if (!parsed.success) {
    toast.add({ title: parsed.error.issues[0]?.message ?? 'Check the dates', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/leave', { method: 'POST', body: parsed.data })
    open.value = false
    form.startDate = ''
    form.endDate = ''
    form.reason = ''
    toast.add({ title: 'Leave request submitted', color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not submit', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
async function cancel(r: Req) {
  await $fetch(`/api/leave/${r.id}/cancel`, { method: 'POST' })
  await refresh()
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
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">My Leave</h1>
        <p class="mt-1 text-sm text-muted">Request time off and track your balance.</p>
      </div>
      <UButton icon="i-lucide-plus" label="Request leave" @click="open = true" />
    </header>

    <!-- Balance cards -->
    <div class="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">
          Entitlement {{ data.balance.year }}
        </p>
        <p class="mt-1 text-2xl font-semibold text-default">
          {{ data.balance.entitlement }}<span class="text-sm font-normal text-muted"> days</span>
        </p>
      </div>
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Taken</p>
        <p class="mt-1 text-2xl font-semibold text-default">{{ data.balance.used }}</p>
      </div>
      <div class="rounded-xl border border-default bg-default p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Pending</p>
        <p class="mt-1 text-2xl font-semibold text-warning">{{ data.balance.pending }}</p>
      </div>
      <div class="rounded-xl border border-primary/30 bg-primary/5 p-4">
        <p class="text-xs uppercase tracking-wide text-muted">Remaining</p>
        <p class="mt-1 text-2xl font-semibold text-primary">{{ data.balance.remaining }}</p>
      </div>
    </div>

    <!-- Requests -->
    <div
      v-if="!data.requests.length"
      class="rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-palmtree" class="size-10 text-muted" />
      <p class="mt-2 text-sm text-muted">No leave requests yet.</p>
    </div>
    <div v-else class="overflow-hidden rounded-xl border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Type</th>
            <th class="px-4 py-2 font-medium">Dates</th>
            <th class="px-4 py-2 font-medium">Days</th>
            <th class="px-4 py-2 font-medium">Status</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="r in data.requests" :key="r.id">
            <td class="px-4 py-2.5 text-default">{{ LEAVE_TYPE_LABEL[r.type] }}</td>
            <td class="px-4 py-2.5 text-muted">
              {{ fdate(r.startDate) }} → {{ fdate(r.endDate) }}
            </td>
            <td class="px-4 py-2.5 text-muted">{{ Number(r.days) }}</td>
            <td class="px-4 py-2.5">
              <UBadge
                :color="LEAVE_STATUS_COLOR[r.status]"
                variant="subtle"
                size="xs"
                :label="LEAVE_STATUS_LABEL[r.status]"
              />
              <span v-if="r.decisionNote" class="ml-2 text-xs text-muted">{{
                r.decisionNote
              }}</span>
            </td>
            <td class="px-4 py-2.5 text-right">
              <UButton
                v-if="r.status === 'pending'"
                size="xs"
                variant="ghost"
                color="neutral"
                label="Cancel"
                @click="cancel(r)"
              />
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <UModal v-model:open="open" title="Request leave">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Type"
            ><USelect v-model="form.type" :items="typeItems" value-key="value" class="w-full"
          /></UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="From" required
              ><UInput v-model="form.startDate" type="date" class="w-full"
            /></UFormField>
            <UFormField label="To" required
              ><UInput v-model="form.endDate" type="date" class="w-full"
            /></UFormField>
          </div>
          <UFormField label="Reason"
            ><UTextarea v-model="form.reason" :rows="2" class="w-full" placeholder="Optional"
          /></UFormField>
          <p class="text-xs text-muted">
            Working days (Mon–Fri) in the range are counted automatically.
          </p>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" /><UButton
            label="Submit"
            :loading="saving"
            @click="submit"
          /></div
      ></template>
    </UModal>
  </div>
</template>
