<script setup lang="ts">
import { LEAVE_TYPE_LABEL, type LeaveStatus, type LeaveType } from '@@/shared/schemas/hr'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Leave — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canDecide = computed(() => can.value('hr', 'update'))
const toast = useToast()

interface Item {
  id: string
  userId: string
  firstName: string | null
  lastName: string | null
  type: LeaveType
  startDate: string
  endDate: string
  days: string
  reason: string | null
  status: LeaveStatus
  decisionNote: string | null
}
const { data, refresh } = await useFetch<{ items: Item[] }>('/api/hr/leave', {
  key: 'hr-leave',
  default: () => ({ items: [] }),
})
const name = (i: Item) => [i.firstName, i.lastName].filter(Boolean).join(' ') || 'Staff'

const tab = ref<'approvals' | 'calendar'>('approvals')
const pending = computed(() => (data.value?.items ?? []).filter((i) => i.status === 'pending'))

async function decide(i: Item, status: 'approved' | 'rejected') {
  if (!canDecide.value) return
  let note: string | null = null
  if (status === 'rejected') {
    note = window.prompt('Reason for declining (optional):') ?? ''
  }
  try {
    await $fetch(`/api/hr/leave/${i.id}`, { method: 'PATCH', body: { status, decisionNote: note } })
    toast.add({
      title: `Leave ${status === 'approved' ? 'approved' : 'declined'}`,
      color: 'success',
    })
    await refresh()
  } catch {
    toast.add({ title: 'Action failed', color: 'error' })
  }
}

// ── Team calendar (month timeline) ──
const monthOffset = ref(0)
const viewMonth = computed(() => {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + monthOffset.value)
  return d
})
const monthLabel = computed(() =>
  viewMonth.value.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })
)
const daysInMonth = computed(() =>
  new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth() + 1, 0).getDate()
)
function dayIndex(iso: string) {
  return new Date(`${iso}T00:00:00`)
}
const monthStart = computed(
  () => new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth(), 1)
)
const monthEnd = computed(
  () => new Date(viewMonth.value.getFullYear(), viewMonth.value.getMonth(), daysInMonth.value)
)

interface Bar {
  item: Item
  left: number
  width: number
}
const calendarRows = computed(() => {
  const rows: { userId: string; name: string; bars: Bar[] }[] = []
  const relevant = (data.value?.items ?? []).filter(
    (i) => i.status === 'approved' || i.status === 'pending'
  )
  for (const i of relevant) {
    const s = dayIndex(i.startDate)
    const e = dayIndex(i.endDate)
    if (e < monthStart.value || s > monthEnd.value) continue
    const from = Math.max(1, s < monthStart.value ? 1 : s.getDate())
    const to = Math.min(daysInMonth.value, e > monthEnd.value ? daysInMonth.value : e.getDate())
    const bar: Bar = {
      item: i,
      left: ((from - 1) / daysInMonth.value) * 100,
      width: ((to - from + 1) / daysInMonth.value) * 100,
    }
    let row = rows.find((r) => r.userId === i.userId)
    if (!row) {
      row = { userId: i.userId, name: name(i), bars: [] }
      rows.push(row)
    }
    row.bars.push(bar)
  }
  return rows.sort((a, b) => a.name.localeCompare(b.name))
})
const barColor: Record<LeaveStatus, string> = {
  approved: 'bg-primary',
  pending: 'bg-warning/60',
  rejected: 'bg-error',
  cancelled: 'bg-elevated',
}
function fdate(s: string) {
  return new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Leave</h1>
        <p class="mt-1 text-sm text-muted">Approve requests and view who's off across the team.</p>
      </div>
      <UButton to="/hr" variant="link" color="neutral" icon="i-lucide-arrow-left" label="People" />
    </header>

    <div class="flex gap-1 border-b border-default">
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium"
        :class="
          tab === 'approvals' ? 'border-primary text-primary' : 'border-transparent text-muted'
        "
        @click="tab = 'approvals'"
      >
        Approvals
        <UBadge
          v-if="pending.length"
          color="warning"
          variant="subtle"
          size="xs"
          :label="String(pending.length)"
          class="ml-1"
        />
      </button>
      <button
        class="border-b-2 px-3 py-2 text-sm font-medium"
        :class="
          tab === 'calendar' ? 'border-primary text-primary' : 'border-transparent text-muted'
        "
        @click="tab = 'calendar'"
      >
        Team calendar
      </button>
    </div>

    <!-- Approvals -->
    <div v-show="tab === 'approvals'" class="space-y-3">
      <p
        v-if="!pending.length"
        class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted"
      >
        No requests awaiting decision.
      </p>
      <div
        v-for="i in pending"
        :key="i.id"
        class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-default p-4"
      >
        <div>
          <p class="font-medium text-default">
            {{ name(i) }}
            <span class="text-sm font-normal text-muted">· {{ LEAVE_TYPE_LABEL[i.type] }}</span>
          </p>
          <p class="text-sm text-muted">
            {{ fdate(i.startDate) }} → {{ fdate(i.endDate) }} · {{ Number(i.days) }} day(s)
          </p>
          <p v-if="i.reason" class="mt-1 text-xs text-dimmed">"{{ i.reason }}"</p>
        </div>
        <div v-if="canDecide" class="flex gap-2">
          <UButton
            size="sm"
            color="error"
            variant="soft"
            label="Decline"
            @click="decide(i, 'rejected')"
          />
          <UButton size="sm" color="success" label="Approve" @click="decide(i, 'approved')" />
        </div>
      </div>
    </div>

    <!-- Calendar -->
    <div v-show="tab === 'calendar'" class="space-y-3">
      <div class="flex items-center justify-between">
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-chevron-left"
          @click="monthOffset--"
        />
        <span class="text-sm font-medium text-default">{{ monthLabel }}</span>
        <UButton
          size="xs"
          variant="ghost"
          color="neutral"
          icon="i-lucide-chevron-right"
          @click="monthOffset++"
        />
      </div>
      <p
        v-if="!calendarRows.length"
        class="rounded-xl border border-dashed border-default p-10 text-center text-sm text-muted"
      >
        No leave scheduled this month.
      </p>
      <div v-else class="overflow-hidden rounded-xl border border-default">
        <div
          v-for="row in calendarRows"
          :key="row.userId"
          class="flex items-center gap-3 border-b border-default px-3 py-2 last:border-0"
        >
          <div class="w-32 shrink-0 truncate text-sm text-default">{{ row.name }}</div>
          <div class="relative h-6 flex-1 rounded bg-elevated/50">
            <div
              v-for="(b, idx) in row.bars"
              :key="idx"
              class="absolute top-0.5 h-5 rounded"
              :class="barColor[b.item.status]"
              :style="{ left: `${b.left}%`, width: `${b.width}%` }"
              :title="`${LEAVE_TYPE_LABEL[b.item.type]} · ${fdate(b.item.startDate)}–${fdate(b.item.endDate)}`"
            />
          </div>
        </div>
      </div>
      <div class="flex items-center gap-4 text-xs text-muted">
        <span class="flex items-center gap-1"
          ><span class="inline-block size-3 rounded bg-primary" /> Approved</span
        >
        <span class="flex items-center gap-1"
          ><span class="inline-block size-3 rounded bg-warning/60" /> Pending</span
        >
      </div>
    </div>
  </div>
</template>
