<script setup lang="ts">
import {
  TIMESHEET_STATUS_COLOR,
  TIMESHEET_STATUS_LABEL,
  timesheetEntrySchema,
  type TimesheetStatus,
} from '@@/shared/schemas/timesheet'

definePageMeta({ layout: 'dashboard' })
useHead({ title: 'Timesheets — Camel OS' })

interface Entry {
  id: string
  entryDate: string
  hours: string
  projectId: string | null
  projectName: string | null
  activityId: string | null
  taskLabel: string | null
  note: string | null
  status: TimesheetStatus
  decisionNote: string | null
}
interface Week {
  weekStart: string
  entries: Entry[]
  total: number
  weekStatus: TimesheetStatus
  locked: boolean
}

// Monday of the current view week.
function mondayOf(d: Date) {
  const x = new Date(d)
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7))
  return x.toISOString().slice(0, 10)
}
const weekStart = ref(mondayOf(new Date()))
const { data, refresh } = await useFetch<Week>('/api/timesheets', {
  query: { weekStart },
  key: 'my-timesheet',
  default: (): Week => ({
    weekStart: weekStart.value,
    entries: [],
    total: 0,
    weekStatus: 'draft',
    locked: false,
  }),
})
const { data: options } = await useFetch<{
  projects: { id: string; name: string; activities: { id: string; name: string }[] }[]
}>('/api/timesheets/options', { key: 'ts-options', default: () => ({ projects: [] }) })

const toast = useToast()
function shiftWeek(delta: number) {
  const d = new Date(`${weekStart.value}T00:00:00`)
  d.setDate(d.getDate() + delta * 7)
  weekStart.value = mondayOf(d)
}
const weekLabel = computed(() => {
  const s = new Date(`${weekStart.value}T00:00:00`)
  const e = new Date(s)
  e.setDate(e.getDate() + 6)
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
  return `${fmt(s)} – ${fmt(e)}`
})

// Add-entry modal
const open = ref(false)
const saving = ref(false)
const form = reactive({
  entryDate: weekStart.value,
  projectId: '',
  activityId: '',
  taskLabel: '',
  hours: '',
  note: '',
})
watch(open, (v) => {
  if (v)
    Object.assign(form, {
      entryDate: weekStart.value,
      projectId: '',
      activityId: '',
      taskLabel: '',
      hours: '',
      note: '',
    })
})
const projectItems = computed(() => [
  { label: '🗂 Internal task (no project)', value: '' },
  ...(options.value?.projects ?? []).map((p) => ({ label: p.name, value: p.id })),
])
const activityItems = computed(() => {
  const proj = options.value?.projects.find((p) => p.id === form.projectId)
  return [
    { label: '— No specific activity —', value: '' },
    ...(proj?.activities ?? []).map((a) => ({ label: a.name, value: a.id })),
  ]
})

async function add() {
  const parsed = timesheetEntrySchema.safeParse({
    entryDate: form.entryDate,
    hours: form.hours,
    projectId: form.projectId || null,
    activityId: form.activityId || null,
    taskLabel: form.taskLabel || null,
    note: form.note || null,
  })
  if (!parsed.success) {
    toast.add({ title: parsed.error.issues[0]?.message ?? 'Check the entry', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await $fetch('/api/timesheets', { method: 'POST', body: parsed.data })
    open.value = false
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not log time', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
async function del(e: Entry) {
  const endpoint: string = `/api/timesheets/${e.id}`
  await $fetch(endpoint, { method: 'DELETE' })
  await refresh()
}
async function submitWeek() {
  try {
    await $fetch('/api/timesheets/submit', { method: 'POST', body: { weekStart: weekStart.value } })
    toast.add({ title: 'Timesheet submitted for approval', color: 'success' })
    await refresh()
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not submit', description: msg, color: 'error' })
  }
}
function fday(s: string) {
  return new Date(`${s}T00:00:00`).toLocaleDateString(undefined, {
    weekday: 'short',
    day: 'numeric',
  })
}
function label(e: Entry) {
  return e.projectName ?? e.taskLabel ?? 'Task'
}
</script>

<template>
  <div class="space-y-5">
    <header class="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 class="text-2xl font-semibold tracking-tight text-default">Timesheets</h1>
        <p class="mt-1 text-sm text-muted">Log daily hours and submit your week for approval.</p>
      </div>
      <UButton v-if="!data.locked" icon="i-lucide-plus" label="Log time" @click="open = true" />
    </header>

    <!-- Week bar -->
    <div class="flex items-center justify-between rounded-xl border border-default bg-default p-3">
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-chevron-left"
        @click="shiftWeek(-1)"
      />
      <div class="text-center">
        <p class="text-sm font-medium text-default">{{ weekLabel }}</p>
        <UBadge
          :color="TIMESHEET_STATUS_COLOR[data.weekStatus]"
          variant="subtle"
          size="xs"
          :label="TIMESHEET_STATUS_LABEL[data.weekStatus]"
          class="mt-0.5"
        />
      </div>
      <UButton
        size="xs"
        variant="ghost"
        color="neutral"
        icon="i-lucide-chevron-right"
        @click="shiftWeek(1)"
      />
    </div>

    <div
      v-if="data.weekStatus === 'rejected' && data.entries[0]?.decisionNote"
      class="rounded-lg border border-error/40 bg-error/5 p-3 text-sm text-default"
    >
      <span class="font-medium text-error">Returned:</span> {{ data.entries[0].decisionNote }}
    </div>

    <!-- Entries -->
    <div
      v-if="!data.entries.length"
      class="rounded-xl border border-dashed border-default p-12 text-center"
    >
      <UIcon name="i-lucide-clock" class="size-10 text-muted" />
      <p class="mt-2 text-sm text-muted">No time logged this week.</p>
    </div>
    <div v-else class="overflow-hidden rounded-xl border border-default">
      <table class="w-full text-sm">
        <thead class="bg-elevated/40 text-left text-xs uppercase tracking-wide text-muted">
          <tr>
            <th class="px-4 py-2 font-medium">Day</th>
            <th class="px-4 py-2 font-medium">Project / task</th>
            <th class="px-4 py-2 font-medium">Hours</th>
            <th class="px-4 py-2"></th>
          </tr>
        </thead>
        <tbody class="divide-y divide-default">
          <tr v-for="e in data.entries" :key="e.id">
            <td class="px-4 py-2.5 text-muted">{{ fday(e.entryDate) }}</td>
            <td class="px-4 py-2.5 text-default">
              {{ label(e) }}
              <span v-if="e.note" class="block text-xs text-muted">{{ e.note }}</span>
            </td>
            <td class="px-4 py-2.5 font-medium text-default">{{ Number(e.hours) }}</td>
            <td class="px-4 py-2.5 text-right">
              <UButton
                v-if="!data.locked"
                size="xs"
                variant="ghost"
                color="error"
                icon="i-lucide-trash-2"
                aria-label="Delete"
                @click="del(e)"
              />
            </td>
          </tr>
        </tbody>
        <tfoot class="border-t border-default bg-elevated/30">
          <tr>
            <td class="px-4 py-2 text-xs uppercase text-muted" colspan="2">Total</td>
            <td class="px-4 py-2 font-semibold text-default" colspan="2">{{ data.total }} h</td>
          </tr>
        </tfoot>
      </table>
    </div>

    <div v-if="!data.locked && data.entries.length" class="flex justify-end">
      <UButton icon="i-lucide-send" label="Submit week for approval" @click="submitWeek" />
    </div>
    <p v-else-if="data.weekStatus === 'submitted'" class="text-center text-sm text-muted">
      Submitted — awaiting manager approval.
    </p>
    <p v-else-if="data.weekStatus === 'approved'" class="text-center text-sm text-success">
      Approved ✓
    </p>

    <!-- Add modal -->
    <UModal v-model:open="open" title="Log time">
      <template #body>
        <div class="space-y-3">
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Date" required
              ><UInput v-model="form.entryDate" type="date"
            /></UFormField>
            <UFormField label="Hours" required
              ><UInput v-model="form.hours" type="number" step="0.25" placeholder="e.g. 4"
            /></UFormField>
          </div>
          <UFormField label="Project"
            ><USelect
              v-model="form.projectId"
              :items="projectItems"
              value-key="value"
              class="w-full"
          /></UFormField>
          <UFormField v-if="form.projectId" label="Activity"
            ><USelect
              v-model="form.activityId"
              :items="activityItems"
              value-key="value"
              class="w-full"
          /></UFormField>
          <UFormField v-else label="Internal task" required
            ><UInput v-model="form.taskLabel" placeholder="e.g. Admin, business development"
          /></UFormField>
          <UFormField label="Note"
            ><UTextarea v-model="form.note" :rows="2" class="w-full"
          /></UFormField>
        </div>
      </template>
      <template #footer
        ><div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" /><UButton
            label="Add"
            :loading="saving"
            @click="add"
          /></div
      ></template>
    </UModal>
  </div>
</template>
