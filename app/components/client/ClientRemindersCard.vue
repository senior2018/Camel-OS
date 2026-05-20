<script setup lang="ts">
import type { CreateReminderPayload, UpdateReminderPayload } from '@@/shared/schemas/client'
import type { ClientReminder } from '@/composables/useClient'

interface Props {
  reminders: ClientReminder[]
  team: Array<{ id: string; email: string; firstName: string; lastName: string }>
  /** Current user id — used to default the assignee on new reminders. */
  currentUserId: string
  canEdit: boolean
  /** Whether to show the admin-only "Run dispatcher" button. */
  isAdmin?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  create: [payload: CreateReminderPayload]
  update: [reminderId: string, payload: UpdateReminderPayload]
  remove: [reminderId: string]
  'dispatcher-ran': [summary: { scanned: number; sent: number; skipped: number; errors: number }]
}>()

// Tick once a minute so dueState() recomputes and the "overdue" badge appears
// without the user having to refresh. `now` is read by dueState via a closure.
const now = ref(Date.now())
let tickHandle: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  tickHandle = setInterval(() => {
    now.value = Date.now()
  }, 60_000)
})
onUnmounted(() => {
  if (tickHandle) clearInterval(tickHandle)
})

const toast = useToast()
const runningDispatcher = ref(false)
async function runDispatcher() {
  runningDispatcher.value = true
  try {
    const res = await $fetch<{
      success: boolean
      summary: { scanned: number; sent: number; skipped: number; errors: number }
    }>('/api/admin/tasks/client-reminders', { method: 'POST' })
    toast.add({
      title: 'Dispatcher ran',
      description: `${res.summary.sent} sent · ${res.summary.scanned} scanned`,
      color: 'success',
    })
    emit('dispatcher-ran', res.summary)
  } catch (err) {
    toast.add({
      title: 'Dispatcher failed',
      description:
        (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.',
      color: 'error',
    })
  } finally {
    runningDispatcher.value = false
  }
}

const showForm = ref(false)
const form = reactive<{
  assignedUserId: string
  dueAt: string
  message: string
}>({
  assignedUserId: props.currentUserId,
  dueAt: '',
  message: '',
})

const assigneeOptions = computed(() =>
  props.team.map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id,
  }))
)

const pending = computed(() => props.reminders.filter((r) => !r.completedAt))
const done = computed(() => props.reminders.filter((r) => r.completedAt))

function openForm() {
  form.assignedUserId = props.currentUserId
  form.dueAt = ''
  form.message = ''
  showForm.value = true
}

function submit() {
  if (!form.dueAt || !form.message.trim()) return
  // datetime-local gives us "YYYY-MM-DDTHH:mm" without timezone — convert to
  // a UTC ISO string so the backend stores an unambiguous instant.
  const dueIso = new Date(form.dueAt).toISOString()
  emit('create', {
    assignedUserId: form.assignedUserId,
    dueAt: dueIso,
    message: form.message,
  } as CreateReminderPayload)
  showForm.value = false
}

function toggleComplete(r: ClientReminder) {
  emit('update', r.id, { completed: !r.completedAt })
}

function assigneeLabel(r: ClientReminder): string {
  return (
    [r.assignedFirstName, r.assignedLastName].filter(Boolean).join(' ') ||
    r.assignedEmail ||
    'Unknown'
  )
}

function dueState(r: ClientReminder): 'overdue' | 'today' | 'soon' | 'later' {
  const due = new Date(r.dueAt).getTime()
  const nowMs = now.value
  if (due < nowMs) return 'overdue'
  const todayStart = new Date(nowMs)
  todayStart.setHours(0, 0, 0, 0)
  const todayEnd = todayStart.getTime() + 86_400_000
  if (due < todayEnd) return 'today'
  const days = Math.floor((due - nowMs) / 86_400_000)
  if (days <= 3) return 'soon'
  return 'later'
}

function formatDue(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
</script>

<template>
  <UCard>
    <template #header>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h3 class="text-sm font-semibold text-default">Reminders</h3>
        <div class="flex items-center gap-2">
          <UTooltip
            v-if="isAdmin"
            text="Manually run the reminder dispatcher (admin only). Hourly cron runs automatically."
          >
            <UButton
              size="xs"
              variant="ghost"
              color="neutral"
              icon="i-lucide-bell-ring"
              label="Run now"
              :loading="runningDispatcher"
              @click="runDispatcher"
            />
          </UTooltip>
          <UButton
            v-if="canEdit"
            size="xs"
            variant="outline"
            icon="i-lucide-plus"
            label="New reminder"
            @click="openForm"
          />
        </div>
      </div>
    </template>

    <div
      v-if="!reminders.length"
      class="rounded-lg border border-dashed border-default p-6 text-center text-sm text-muted"
    >
      No reminders set.
    </div>

    <div v-else class="space-y-4">
      <div v-if="pending.length">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Pending</p>
        <ul class="space-y-2">
          <li
            v-for="r in pending"
            :key="r.id"
            class="flex items-start gap-3 rounded-lg border border-default bg-default p-3"
          >
            <UCheckbox :model-value="false" @update:model-value="toggleComplete(r)" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-default">{{ r.message }}</p>
              <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted">
                <UBadge
                  :color="
                    dueState(r) === 'overdue'
                      ? 'error'
                      : dueState(r) === 'today'
                        ? 'warning'
                        : dueState(r) === 'soon'
                          ? 'primary'
                          : 'neutral'
                  "
                  variant="subtle"
                  size="xs"
                  :label="`Due ${formatDue(r.dueAt)}`"
                />
                <span>· {{ assigneeLabel(r) }}</span>
              </div>
            </div>
            <UButton
              v-if="canEdit"
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-trash-2"
              aria-label="Delete"
              @click="emit('remove', r.id)"
            />
          </li>
        </ul>
      </div>

      <div v-if="done.length">
        <p class="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Completed</p>
        <ul class="space-y-2">
          <li
            v-for="r in done"
            :key="r.id"
            class="flex items-start gap-3 rounded-lg border border-default bg-elevated/30 p-3"
          >
            <UCheckbox :model-value="true" @update:model-value="toggleComplete(r)" />
            <div class="min-w-0 flex-1">
              <p class="text-sm text-muted line-through">{{ r.message }}</p>
              <p class="mt-1 text-xs text-muted">
                Was due {{ formatDue(r.dueAt) }} · {{ assigneeLabel(r) }}
              </p>
            </div>
          </li>
        </ul>
      </div>
    </div>

    <UModal v-model:open="showForm" title="New reminder">
      <template #body>
        <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <UFormField label="Due date & time" required>
            <UInput v-model="form.dueAt" type="datetime-local" class="w-full" />
          </UFormField>
          <UFormField label="Assigned to" required>
            <USelectMenu
              v-model="form.assignedUserId"
              :items="assigneeOptions"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Message" required class="sm:col-span-2">
            <UTextarea v-model="form.message" :rows="3" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="ml-auto flex gap-3">
          <UButton variant="ghost" label="Cancel" @click="showForm = false" />
          <UButton label="Create" @click="submit" />
        </div>
      </template>
    </UModal>
  </UCard>
</template>
