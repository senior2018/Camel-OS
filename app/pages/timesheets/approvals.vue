<script setup lang="ts">
definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Timesheet Approvals — Camel OS' })

const { can } = await usePermissions()
if (!can.value('hr', 'read') && !can.value('timesheet', 'read')) {
  throw createError({ statusCode: 403, statusMessage: 'No access', fatal: true })
}
const canDecide = computed(() => can.value('timesheet', 'update'))
const toast = useToast()

interface Group {
  userId: string
  name: string
  weekStart: string
  status: string
  total: number
  entries: { entryDate: string; hours: number; label: string; note: string | null }[]
}
const { data, refresh } = await useFetch<{ items: Group[] }>('/api/hr/timesheets', {
  query: { status: 'submitted' },
  key: 'ts-approvals',
  default: () => ({ items: [] }),
})

const detailOpen = ref(false)
const detailGroup = ref<Group | null>(null)
function openGroup(g: Group) {
  detailGroup.value = g
  detailOpen.value = true
}
async function decide(g: Group, status: 'approved' | 'rejected') {
  if (!canDecide.value) return
  let note: string | null = null
  if (status === 'rejected') note = window.prompt('Reason for returning (optional):') ?? ''
  try {
    await $fetch('/api/hr/timesheets/decision', {
      method: 'PATCH',
      body: { userId: g.userId, weekStart: g.weekStart, status, decisionNote: note },
    })
    toast.add({
      title: `Timesheet ${status === 'approved' ? 'approved' : 'returned'}`,
      color: 'success',
    })
    detailOpen.value = false
    await refresh()
  } catch {
    toast.add({ title: 'Action failed', color: 'error' })
  }
}
function wlabel(w: string) {
  if (w === 'unscheduled') return 'Unscheduled'
  const s = new Date(`${w}T00:00:00`)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  const f = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${f(s)} – ${f(e)}`
}
function fday(s: string) {
  return new Date(`${s}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
  })
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Timesheet Approvals</h1>
        <p class="mt-1 text-sm text-muted">Submitted weeks awaiting your decision.</p>
      </div>
      <div class="flex gap-2">
        <UButton
          to="/timesheets/report"
          variant="outline"
          color="neutral"
          icon="i-lucide-bar-chart-3"
          label="Reports"
        />
        <UButton
          to="/timesheets"
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="My timesheet"
        />
      </div>
    </header>

    <p
      v-if="!data.items.length"
      class="rounded-xl border border-dashed border-default p-12 text-center text-sm text-muted"
    >
      Nothing awaiting approval.
    </p>
    <div
      v-for="g in data.items"
      :key="`${g.userId}-${g.weekStart}`"
      class="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-default bg-default p-4 shadow-sm"
    >
      <div class="min-w-0">
        <p class="font-medium text-default">{{ g.name }}</p>
        <p class="text-xs text-muted">Week of {{ wlabel(g.weekStart) }} · {{ g.total }} h</p>
      </div>
      <div class="flex gap-2">
        <UButton
          size="sm"
          variant="outline"
          color="neutral"
          icon="i-lucide-eye"
          label="View"
          @click="openGroup(g)"
        />
        <template v-if="canDecide">
          <UButton
            size="sm"
            color="error"
            variant="soft"
            label="Return"
            @click="decide(g, 'rejected')"
          />
          <UButton size="sm" color="success" label="Approve" @click="decide(g, 'approved')" />
        </template>
      </div>
    </div>

    <!-- Detail modal -->
    <UModal
      v-model:open="detailOpen"
      :title="detailGroup ? `${detailGroup.name} · ${wlabel(detailGroup.weekStart)}` : 'Timesheet'"
    >
      <template #body>
        <div v-if="detailGroup" class="overflow-x-auto">
          <table class="w-full text-sm">
            <thead class="text-left text-xs uppercase tracking-wide text-muted">
              <tr>
                <th class="py-1.5 pr-3 font-medium">Day</th>
                <th class="py-1.5 pr-3 font-medium">Project / task</th>
                <th class="py-1.5 text-right font-medium">Hours</th>
              </tr>
            </thead>
            <tbody class="divide-y divide-default">
              <tr v-for="(e, i) in detailGroup.entries" :key="i">
                <td class="whitespace-nowrap py-1.5 pr-3 text-muted">{{ fday(e.entryDate) }}</td>
                <td class="py-1.5 pr-3 text-default">
                  <p>{{ e.label }}</p>
                  <p v-if="e.note" class="whitespace-pre-wrap wrap-break-word text-xs text-muted">
                    {{ e.note }}
                  </p>
                </td>
                <td class="whitespace-nowrap py-1.5 text-right font-medium text-default">
                  {{ e.hours }} h
                </td>
              </tr>
            </tbody>
            <tfoot class="border-t border-default">
              <tr>
                <td class="py-2 text-xs uppercase text-muted" colspan="2">Total</td>
                <td class="py-2 text-right font-semibold text-default">
                  {{ detailGroup.total }} h
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </template>
      <template #footer>
        <div v-if="detailGroup" class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Close" @click="detailOpen = false" />
          <template v-if="canDecide">
            <UButton
              color="error"
              variant="soft"
              label="Return"
              @click="decide(detailGroup, 'rejected')"
            />
            <UButton color="success" label="Approve" @click="decide(detailGroup, 'approved')" />
          </template>
        </div>
      </template>
    </UModal>
  </div>
</template>
