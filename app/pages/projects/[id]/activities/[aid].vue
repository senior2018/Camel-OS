<script setup lang="ts">
import {
  DEFAULT_PROJECT_SETTINGS,
  STATUS_CATEGORY_COLOR,
  type ProjectSettings,
  type StatusCategory,
} from '@@/shared/schemas/project-settings'

definePageMeta({ layout: 'dashboard' })
const route = useRoute()
const id = route.params.id as string
const aid = route.params.aid as string
const toast = useToast()

interface ActivityDetail {
  activity: {
    id: string
    name: string
    description: string | null
    milestoneId: string | null
    milestoneName: string | null
    assignedUserId: string | null
    assigneeName: string | null
    creatorName: string | null
    startDate: string | null
    endDate: string | null
    plannedHours: string | null
    percentComplete: number
    statusLabel: string
    statusCategory: StatusCategory
  }
  comments: {
    id: string
    body: string
    userId: string | null
    firstName: string | null
    lastName: string | null
    createdAt: string
  }[]
  permissions: { isLead: boolean; isAssignee: boolean; canComment: boolean; canEditStatus: boolean }
}

const { data, refresh } = await useFetch<ActivityDetail>(`/api/projects/${id}/activities/${aid}`, {
  key: `activity-${aid}`,
})
if (!data.value)
  throw createError({ statusCode: 404, statusMessage: 'Activity not found', fatal: true })
useHead(() => ({ title: `${data.value?.activity.name ?? 'Activity'} — Camel OS` }))

const { data: settingsData } = useFetch<{ settings: ProjectSettings }>('/api/projects/settings', {
  key: 'project-settings',
  default: () => ({ settings: { ...DEFAULT_PROJECT_SETTINGS } }),
})
const statusItems = computed(() =>
  (settingsData.value?.settings ?? DEFAULT_PROJECT_SETTINGS).activityStatuses.map((s) => ({
    label: s.label,
    value: s.label,
  }))
)
const catColor = (c: StatusCategory) => STATUS_CATEGORY_COLOR[c]
const fdate = (s: string | null) =>
  s
    ? new Date(s).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
    : '—'
const when = (s: string) =>
  new Date(s).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
const commenterName = (c: { firstName: string | null; lastName: string | null }) =>
  [c.firstName, c.lastName].filter(Boolean).join(' ') || 'User'

// Milestones + users for the edit form pickers.
const { data: detail } = useFetch<{
  milestones: { id: string; name: string }[]
}>(`/api/projects/${id}`, { key: `project-${id}`, default: () => ({ milestones: [] }) })
const { data: usersData } = useFetch<{
  users: { id: string; firstName: string | null; lastName: string | null; email: string }[]
}>('/api/projects/assignable-users', { key: 'project-users', default: () => ({ users: [] }) })
const NONE_OPT = '__none__'
const milestoneItems = computed(() => [
  { label: 'No milestone', value: NONE_OPT },
  ...(detail.value?.milestones ?? []).map((m) => ({ label: m.name, value: m.id })),
])
const userItems = computed(() =>
  (usersData.value?.users ?? []).map((u) => ({
    label: [u.firstName, u.lastName].filter(Boolean).join(' ') || u.email,
    value: u.id,
  }))
)

// ── Edit activity details (P21 — members; reassign is lead-only) ──
const canEditDetails = computed(() => data.value?.permissions.canComment ?? false)
const editOpen = ref(false)
const editForm = reactive({
  name: '',
  description: '',
  milestoneId: NONE_OPT as string,
  assignedUserId: NONE_OPT as string,
  startDate: '',
  endDate: '',
  plannedHours: null as number | null,
})
function openEdit() {
  const a = data.value?.activity
  if (!a) return
  editForm.name = a.name
  editForm.description = a.description ?? ''
  editForm.milestoneId = a.milestoneId ?? NONE_OPT
  editForm.assignedUserId = a.assignedUserId ?? NONE_OPT
  editForm.startDate = a.startDate ?? ''
  editForm.endDate = a.endDate ?? ''
  editForm.plannedHours = a.plannedHours != null ? Number(a.plannedHours) : null
  editOpen.value = true
}
const savingEdit = ref(false)
async function saveEdit() {
  if (!editForm.name.trim()) {
    toast.add({ title: 'A name is required', color: 'warning' })
    return
  }
  savingEdit.value = true
  try {
    const body: Record<string, unknown> = {
      name: editForm.name.trim(),
      description: editForm.description.trim() || null,
      milestoneId: editForm.milestoneId === NONE_OPT ? null : editForm.milestoneId,
      startDate: editForm.startDate || null,
      endDate: editForm.endDate || null,
      plannedHours: editForm.plannedHours != null ? Number(editForm.plannedHours) : null,
    }
    // Reassignment is only accepted server-side from a lead; send it only then.
    if (data.value?.permissions.isLead)
      body.assignedUserId = editForm.assignedUserId === NONE_OPT ? null : editForm.assignedUserId
    await $fetch(`/api/projects/${id}/activities/${aid}`, { method: 'PATCH', body })
    toast.add({ title: 'Activity updated', color: 'success' })
    editOpen.value = false
    await refresh()
  } catch (err) {
    toast.add({
      title: 'Could not update',
      description: (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed',
      color: 'error',
    })
  } finally {
    savingEdit.value = false
  }
}

const busy = ref(false)
async function setStatus(statusLabel: string) {
  if (busy.value) return
  busy.value = true
  try {
    await $fetch(`/api/projects/${id}/activities/${aid}`, {
      method: 'PATCH',
      body: { statusLabel },
    })
    toast.add({ title: 'Status updated', color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({
      title: 'Could not update',
      description: (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed',
      color: 'error',
    })
  } finally {
    busy.value = false
  }
}

const percent = ref(0)
watchEffect(() => {
  percent.value = data.value?.activity.percentComplete ?? 0
})
async function saveProgress() {
  if (busy.value) return
  busy.value = true
  try {
    await $fetch(`/api/projects/${id}/activities/${aid}`, {
      method: 'PATCH',
      body: { percentComplete: Number(percent.value) },
    })
    toast.add({ title: 'Progress saved', color: 'success' })
    await refresh()
  } catch (err) {
    toast.add({
      title: 'Could not save',
      description: (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed',
      color: 'error',
    })
  } finally {
    busy.value = false
  }
}

const comment = ref('')
const posting = ref(false)
async function postComment() {
  if (comment.value.trim().length < 1 || posting.value) return
  posting.value = true
  try {
    await $fetch(`/api/projects/${id}/activities/${aid}/comments`, {
      method: 'POST',
      body: { body: comment.value.trim() },
    })
    comment.value = ''
    await refresh()
  } catch (err) {
    toast.add({
      title: 'Could not post comment',
      description: (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed',
      color: 'error',
    })
  } finally {
    posting.value = false
  }
}
</script>

<template>
  <div v-if="data" class="mx-auto max-w-3xl space-y-5">
    <div class="flex flex-wrap items-start justify-between gap-3 border-b border-default/70 pb-5">
      <div class="min-w-0">
        <UButton
          variant="link"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="Back to project"
          class="-ml-2"
          @click="navigateTo(`/projects/${id}`)"
        />
        <div class="mt-1 flex flex-wrap items-center gap-3">
          <h1 class="text-2xl font-semibold tracking-tight text-default">
            {{ data.activity.name }}
          </h1>
          <UBadge
            :color="catColor(data.activity.statusCategory)"
            variant="subtle"
            :label="data.activity.statusLabel"
          />
        </div>
        <p class="mt-1 text-sm text-muted">
          <span v-if="data.activity.milestoneName">{{ data.activity.milestoneName }} · </span>
          Assigned to {{ data.activity.assigneeName || 'nobody' }}
          <span v-if="data.activity.creatorName">
            · created by {{ data.activity.creatorName }}</span
          >
        </p>
      </div>
      <UButton
        v-if="canEditDetails"
        icon="i-lucide-pencil"
        color="neutral"
        variant="outline"
        label="Edit"
        @click="openEdit()"
      />
    </div>

    <div class="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <div class="space-y-4 lg:col-span-2">
        <UCard v-if="data.activity.description">
          <template #header><h3 class="text-sm font-semibold text-default">Details</h3></template>
          <p class="whitespace-pre-wrap text-sm text-default">{{ data.activity.description }}</p>
        </UCard>

        <!-- Comments / progress thread (P16) -->
        <UCard>
          <template #header
            ><h3 class="text-sm font-semibold text-default">Progress &amp; comments</h3></template
          >
          <ul v-if="data.comments.length" class="space-y-3">
            <li v-for="c in data.comments" :key="c.id" class="flex gap-3">
              <div
                class="flex size-8 shrink-0 items-center justify-center rounded-full bg-elevated text-xs font-semibold text-muted"
              >
                {{ commenterName(c).charAt(0) }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-xs text-muted">
                  <span class="font-medium text-default">{{ commenterName(c) }}</span> ·
                  {{ when(c.createdAt) }}
                </p>
                <p class="whitespace-pre-wrap text-sm text-default">{{ c.body }}</p>
              </div>
            </li>
          </ul>
          <p v-else class="text-sm text-muted">No updates yet.</p>

          <div
            v-if="data.permissions.canComment"
            class="mt-4 space-y-2 border-t border-default pt-3"
          >
            <UTextarea
              v-model="comment"
              :rows="2"
              class="w-full"
              placeholder="Share a progress update or leave a comment…"
            />
            <div class="flex justify-end">
              <UButton
                size="sm"
                label="Post"
                :loading="posting"
                :disabled="!comment.trim()"
                @click="postComment"
              />
            </div>
          </div>
        </UCard>
      </div>

      <div class="space-y-4">
        <UCard>
          <template #header><h3 class="text-sm font-semibold text-default">Status</h3></template>
          <div class="space-y-3">
            <div v-if="data.permissions.canEditStatus">
              <USelect
                :model-value="data.activity.statusLabel"
                :items="statusItems"
                value-key="value"
                class="w-full"
                @update:model-value="(v) => setStatus(v as string)"
              />
            </div>
            <UBadge
              v-else
              :color="catColor(data.activity.statusCategory)"
              variant="subtle"
              :label="data.activity.statusLabel"
            />

            <div>
              <div class="mb-1 flex items-center justify-between text-xs text-muted">
                <span>Progress</span><span>{{ percent }}%</span>
              </div>
              <div class="h-1.5 overflow-hidden rounded-full bg-elevated">
                <div class="h-full rounded-full bg-primary" :style="{ width: `${percent}%` }" />
              </div>
              <div v-if="data.permissions.canEditStatus" class="mt-2 flex items-center gap-2">
                <UInputNumber v-model="percent" :min="0" :max="100" size="sm" class="flex-1" />
                <UButton
                  size="sm"
                  variant="soft"
                  label="Save"
                  :loading="busy"
                  @click="saveProgress"
                />
              </div>
            </div>
          </div>
        </UCard>

        <UCard>
          <template #header><h3 class="text-sm font-semibold text-default">Schedule</h3></template>
          <dl class="space-y-2 text-sm">
            <div class="flex justify-between">
              <dt class="text-muted">Start</dt>
              <dd class="text-default">{{ fdate(data.activity.startDate) }}</dd>
            </div>
            <div class="flex justify-between">
              <dt class="text-muted">End</dt>
              <dd class="text-default">{{ fdate(data.activity.endDate) }}</dd>
            </div>
            <div v-if="data.activity.plannedHours" class="flex justify-between">
              <dt class="text-muted">Planned hours</dt>
              <dd class="text-default">{{ data.activity.plannedHours }}h</dd>
            </div>
          </dl>
        </UCard>
      </div>
    </div>

    <UModal v-model:open="editOpen" title="Edit activity">
      <template #body>
        <div class="space-y-3">
          <UFormField label="Name" required>
            <UInput v-model="editForm.name" autofocus class="w-full" />
          </UFormField>
          <UFormField label="Description">
            <UTextarea v-model="editForm.description" :rows="3" class="w-full" />
          </UFormField>
          <UFormField label="Milestone">
            <USelect
              v-model="editForm.milestoneId"
              :items="milestoneItems"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField
            v-if="data.permissions.isLead"
            label="Assignee"
            hint="Only the project manager can re-assign"
          >
            <USelect
              v-model="editForm.assignedUserId"
              :items="[{ label: 'Unassigned', value: NONE_OPT }, ...userItems]"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Start">
              <UInput v-model="editForm.startDate" type="date" class="w-full" />
            </UFormField>
            <UFormField label="End">
              <UInput v-model="editForm.endDate" type="date" class="w-full" />
            </UFormField>
          </div>
          <UFormField label="Planned hours">
            <UInputNumber v-model="editForm.plannedHours" :min="0" class="w-full" />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex w-full justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="editOpen = false" />
          <UButton label="Save changes" :loading="savingEdit" @click="saveEdit" />
        </div>
      </template>
    </UModal>
  </div>
</template>
