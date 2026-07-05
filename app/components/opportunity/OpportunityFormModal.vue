<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  OPPORTUNITY_STATUSES,
  OPPORTUNITY_STATUS_DESCRIPTION,
  OPPORTUNITY_STATUS_LABEL,
  createOpportunitySchema,
  type CreateOpportunityPayload,
  type OpportunitySource,
  type OpportunityStatus,
  type OpportunityType,
} from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

interface Props {
  open: boolean
  initial: Opportunity | null
  submitting?: boolean
  canDelete?: boolean
  // Edit the opportunity's fields / delete it. Owner, creator, or admin only.
  canEdit?: boolean
  // Use the Pending / Accepted / Rejected status bar. Any reviewer with
  // opportunity:update — separate from canEdit so reviewers can decide without
  // being able to rewrite the opportunity.
  canChangeStatus?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: CreateOpportunityPayload, id: string | null, pendingFiles: File[]]
  delete: [opp: Opportunity]
  // S7 — status changes replace the old stage transition. Comment is required
  // when moving to 'rejected'; otherwise optional. The API also persists the
  // comment into the comments thread.
  'move-status': [opp: Opportunity, toStatus: OpportunityStatus, comment: string | null]
}>()

// S5b — view-by-default mode for existing opportunities; new opps open in edit.
const editMode = ref(false)

// Buffered status transition (S7). Status buttons set a pending value; the
// dialog captures the comment (required for Reject) and the parent fires
// `move-status` on confirm.
const pendingStatus = ref<OpportunityStatus | null>(null)
const transitionComment = ref('')

function startStatusChange(s: OpportunityStatus) {
  if (!props.initial) return
  if (s === props.initial.status) return
  pendingStatus.value = s
  transitionComment.value = ''
}

function cancelStatusChange() {
  pendingStatus.value = null
  transitionComment.value = ''
}

function confirmStatusChange() {
  if (!props.initial || !pendingStatus.value) return
  const target = pendingStatus.value
  if (target === 'rejected' && !transitionComment.value.trim()) return
  emit('move-status', props.initial, target, transitionComment.value.trim() || null)
  pendingStatus.value = null
  transitionComment.value = ''
}

function statusColor(s: OpportunityStatus): 'warning' | 'success' | 'error' {
  return s === 'pending' ? 'warning' : s === 'accepted' ? 'success' : 'error'
}

const state = reactive<{
  title: string
  description: string
  source: OpportunitySource
  type: OpportunityType
  tagsText: string
  winProbability: number | null
  deadline: string
  estimatedValue: string
  currency: string
  ownerUserId: string | null
  primaryClientId: string | null
}>({
  title: '',
  description: '',
  source: 'other',
  type: 'consulting',
  tagsText: '',
  winProbability: null,
  deadline: '',
  estimatedValue: '',
  currency: 'USD',
  ownerUserId: null,
  primaryClientId: null,
})

// Tags input is a comma/space-separated text field that we normalise on submit.
// Display chips live below the input for clarity.
const parsedTags = computed(() =>
  state.tagsText
    .split(/[,\s]+/)
    .map((t) => t.trim().toLowerCase())
    .filter((t) => t.length > 0 && /^[a-z0-9][a-z0-9_-]*$/.test(t))
)

const pendingFiles = ref<File[]>([])
const pendingFileInput = ref<HTMLInputElement | null>(null)
const ACCEPT =
  '.pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'

function triggerPendingPicker() {
  pendingFileInput.value?.click()
}

function onPendingFileChange(event: Event) {
  const target = event.target as HTMLInputElement
  const files = Array.from(target.files ?? [])
  if (files.length) pendingFiles.value = [...pendingFiles.value, ...files]
  target.value = ''
}

function removePending(index: number) {
  pendingFiles.value = pendingFiles.value.filter((_, i) => i !== index)
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${(n / 1024 / 1024).toFixed(1)} MB`
}

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

interface ClientPickerItem {
  id: string
  name: string
}
const { data: clientData } = await useFetch<{ items: ClientPickerItem[] }>('/api/clients', {
  key: 'clients-list-picker',
  default: () => ({ items: [] }),
})
const clientOptions = computed(() => [
  { label: 'No client', value: null as string | null },
  ...(clientData.value?.items ?? []).map((c) => ({
    label: c.name,
    value: c.id as string | null,
  })),
])

const ownerOptions = computed(() => [
  { label: 'Unassigned', value: null as string | null },
  ...(teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id as string | null,
  })),
])

interface LookupRow {
  kind: string
  key: string
  label: string
}
const { data: lookupData } = await useFetch<{ sources: LookupRow[]; types: LookupRow[] }>(
  '/api/crm/opportunity-lookup-values',
  { key: 'opportunity-lookup-values', default: () => ({ sources: [], types: [] }) }
)
const sourceOptions = computed(() =>
  (lookupData.value?.sources ?? []).map((s) => ({ label: s.label, value: s.key }))
)
const typeOptions = computed(() =>
  (lookupData.value?.types ?? []).map((t) => ({ label: t.label, value: t.key }))
)

function resetFromInitial() {
  if (props.initial) {
    state.title = props.initial.title
    state.description = props.initial.description ?? ''
    state.source = props.initial.source
    state.type = props.initial.type
    state.tagsText = (props.initial.tags ?? []).join(', ')
    state.winProbability = props.initial.winProbability ?? null
    state.deadline = props.initial.deadline ?? ''
    state.estimatedValue = props.initial.estimatedValue ?? ''
    state.currency = props.initial.currency
    state.ownerUserId = props.initial.ownerUserId
    state.primaryClientId = props.initial.primaryClientId
  } else {
    state.title = ''
    state.description = ''
    state.source = 'other'
    state.type = 'consulting'
    state.tagsText = ''
    state.winProbability = null
    state.deadline = ''
    state.estimatedValue = ''
    state.currency = 'USD'
    state.ownerUserId = null
    state.primaryClientId = null
  }
}

watch(
  () => [props.open, props.initial] as const,
  ([open, initial]) => {
    if (!open) return
    pendingFiles.value = []
    resetFromInitial()
    editMode.value = !initial
  },
  { immediate: true }
)

function cancelEdit() {
  resetFromInitial()
  editMode.value = false
}

function onSubmit(_e: FormSubmitEvent<unknown>) {
  emit(
    'submit',
    {
      title: state.title,
      source: state.source,
      type: state.type,
      description: state.description || null,
      tags: parsedTags.value,
      winProbability: state.winProbability,
      deadline: state.deadline || null,
      estimatedValue: state.estimatedValue || null,
      currency: state.currency,
      ownerUserId: state.ownerUserId,
      primaryClientId: state.primaryClientId,
    },
    props.initial?.id ?? null,
    props.initial ? [] : pendingFiles.value
  )
}
</script>

<template>
  <UModal
    :open="open"
    :title="!initial ? 'New opportunity' : editMode ? 'Edit opportunity' : 'Opportunity details'"
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <!-- Only surface the banner when it carries actionable context (the viewer
           can change status). A pure read-only notice is redundant — the clean
           reading layout already makes it obvious nothing is editable. -->
      <UAlert
        v-if="initial && !canEdit && canChangeStatus"
        color="neutral"
        variant="subtle"
        icon="i-lucide-eye"
        title="Review access"
        description="You can change the status and post a comment, but only the owner, creator, or an admin can edit the details."
        class="mb-4"
      />

      <!-- Status bar — replaces the old stage dropdown. Three buttons for the
           three statuses; clicking a non-current status opens the comment dialog. -->
      <div
        v-if="initial && canChangeStatus"
        class="mb-4 flex flex-col gap-3 rounded-lg border border-default bg-elevated/40 p-3"
      >
        <div class="flex items-center gap-2 text-sm">
          <UIcon name="i-lucide-circle-dot" class="size-4 text-muted" />
          <span class="text-muted">Status</span>
          <UBadge variant="subtle" :color="statusColor(initial.status)" size="sm">
            {{ OPPORTUNITY_STATUS_LABEL[initial.status] }}
          </UBadge>
          <span class="text-xs text-muted">{{
            OPPORTUNITY_STATUS_DESCRIPTION[initial.status]
          }}</span>
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <UButton
            v-for="s in OPPORTUNITY_STATUSES"
            :key="s"
            :variant="s === initial.status ? 'solid' : 'outline'"
            :color="statusColor(s)"
            size="sm"
            :label="OPPORTUNITY_STATUS_LABEL[s]"
            :disabled="s === initial.status"
            @click="startStatusChange(s)"
          />
        </div>
      </div>

      <UForm
        v-if="editMode"
        id="opportunity-form"
        :schema="createOpportunitySchema"
        :state="state"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2"
        @submit="onSubmit"
      >
        <UFormField label="Title" name="title" required class="sm:col-span-2">
          <UInput
            v-model="state.title"
            placeholder="Tender / grant title"
            size="lg"
            class="w-full"
            :disabled="!editMode"
          />
        </UFormField>

        <UFormField
          label="Description"
          name="description"
          class="sm:col-span-2"
          hint="Anything else useful — eligibility quirks, contacts, links."
        >
          <UTextarea
            v-model="state.description"
            :rows="3"
            placeholder="Optional extra details about this opportunity"
            class="w-full"
            :disabled="!editMode"
          />
        </UFormField>

        <UFormField label="Source" name="source" required>
          <USelectMenu
            v-model="state.source"
            :items="sourceOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="!editMode"
          />
        </UFormField>

        <UFormField label="Type" name="type" required>
          <USelectMenu
            v-model="state.type"
            :items="typeOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="!editMode"
          />
        </UFormField>

        <UFormField
          label="Tags"
          name="tags"
          class="sm:col-span-2"
          hint="Lowercase words separated by spaces or commas (e.g. tech health education)."
        >
          <UInput
            v-model="state.tagsText"
            placeholder="tech, health, education"
            size="lg"
            class="w-full"
            :disabled="!editMode"
          />
          <div v-if="parsedTags.length" class="mt-2 flex flex-wrap gap-1">
            <UBadge
              v-for="t in parsedTags"
              :key="t"
              variant="subtle"
              color="primary"
              size="xs"
              :label="t"
            />
          </div>
        </UFormField>

        <UFormField label="Deadline" name="deadline">
          <UInput
            v-model="state.deadline"
            type="date"
            size="lg"
            class="w-full"
            :disabled="!editMode"
          />
        </UFormField>

        <UFormField label="Estimated value" name="estimatedValue">
          <div class="flex gap-2">
            <UInput
              v-model="state.estimatedValue"
              type="number"
              placeholder="0"
              size="lg"
              class="flex-1"
              :disabled="!editMode"
            />
            <UInput
              v-model="state.currency"
              maxlength="3"
              size="lg"
              class="w-20"
              :disabled="!editMode"
            />
          </div>
        </UFormField>

        <UFormField
          label="Win probability (%)"
          name="winProbability"
          hint="Manual estimate for now; AI-driven later."
        >
          <UInput
            v-model.number="state.winProbability"
            type="number"
            min="0"
            max="100"
            placeholder="—"
            size="lg"
            class="w-full"
            :disabled="!editMode"
          />
        </UFormField>

        <UFormField label="Assigned to" name="ownerUserId">
          <USelectMenu
            v-model="state.ownerUserId"
            :items="ownerOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="!editMode"
          />
        </UFormField>

        <UFormField label="Primary client" name="primaryClientId" class="sm:col-span-2">
          <USelectMenu
            v-model="state.primaryClientId"
            :items="clientOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="!editMode"
          />
        </UFormField>
      </UForm>

      <!-- READ MODE — a smart reading layout, not a stack of form labels:
           a real heading, meta chips, a description paragraph, then the key
           facts as compact tiles. -->
      <div v-else class="space-y-5">
        <div>
          <h3 class="text-xl font-semibold tracking-tight text-default">{{ state.title }}</h3>
          <div class="mt-2 flex flex-wrap items-center gap-1.5">
            <UBadge
              variant="subtle"
              color="neutral"
              size="sm"
              :label="sourceOptions.find((o) => o.value === state.source)?.label ?? state.source"
            />
            <UBadge
              variant="subtle"
              color="info"
              size="sm"
              :label="typeOptions.find((o) => o.value === state.type)?.label ?? state.type"
            />
            <UBadge
              v-for="t in parsedTags"
              :key="t"
              variant="subtle"
              color="primary"
              size="xs"
              :label="t"
            />
          </div>
        </div>

        <p v-if="state.description" class="text-sm leading-relaxed text-toned">
          {{ state.description }}
        </p>

        <div class="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div class="rounded-lg bg-muted p-3">
            <p class="text-xs text-muted">Estimated value</p>
            <p class="mt-0.5 text-sm font-semibold text-default">
              {{
                state.estimatedValue
                  ? `${state.currency} ${Number(state.estimatedValue).toLocaleString()}`
                  : '—'
              }}
            </p>
          </div>
          <div class="rounded-lg bg-muted p-3">
            <p class="text-xs text-muted">Deadline</p>
            <p class="mt-0.5 text-sm font-semibold text-default">{{ state.deadline || '—' }}</p>
          </div>
          <div class="rounded-lg bg-muted p-3">
            <p class="text-xs text-muted">Win probability</p>
            <p class="mt-0.5 text-sm font-semibold text-default">
              {{ state.winProbability != null ? `${state.winProbability}%` : '—' }}
            </p>
          </div>
          <div class="rounded-lg bg-muted p-3">
            <p class="text-xs text-muted">Assigned to</p>
            <p class="mt-0.5 text-sm font-semibold text-default">
              {{ ownerOptions.find((o) => o.value === state.ownerUserId)?.label ?? 'Unassigned' }}
            </p>
          </div>
          <div class="rounded-lg bg-muted p-3 sm:col-span-2">
            <p class="text-xs text-muted">Primary client</p>
            <p class="mt-0.5 text-sm font-semibold text-default">
              {{ clientOptions.find((o) => o.value === state.primaryClientId)?.label ?? '—' }}
            </p>
          </div>
        </div>
      </div>

      <!-- Existing opp: comments timeline + attachments. -->
      <div v-if="initial" class="mt-6 space-y-6 border-t border-default pt-6">
        <!-- Comments are open to every reviewer who can see the opp — even
             read-only roles like Staff Member. The decision (Accept/Reject)
             requires update permission, but anyone can post their opinion. -->
        <OpportunityCommentsCard :opportunity-id="initial.id" :can-post="true" />
        <OpportunityAttachments
          :opportunity-id="initial.id"
          :can-upload="canEdit"
          :can-delete="canEdit && canDelete"
        />
      </div>

      <!-- New opp: client-side buffered files. -->
      <div v-else class="mt-6 space-y-3 border-t border-default pt-6">
        <div class="flex items-center justify-between">
          <h3 class="text-sm font-semibold text-default">Attachments</h3>
          <div>
            <input
              ref="pendingFileInput"
              type="file"
              class="hidden"
              multiple
              :accept="ACCEPT"
              @change="onPendingFileChange"
            />
            <UButton
              size="sm"
              variant="outline"
              icon="i-lucide-upload"
              label="Add files"
              @click="triggerPendingPicker"
            />
          </div>
        </div>

        <div
          v-if="!pendingFiles.length"
          class="rounded-lg border border-dashed border-default p-4 text-center text-sm text-muted"
        >
          No files attached. They'll upload after you create the opportunity.
        </div>

        <ul v-else class="divide-y divide-default rounded-lg border border-default">
          <li
            v-for="(file, i) in pendingFiles"
            :key="`${file.name}-${i}`"
            class="flex items-center gap-3 px-3 py-2"
          >
            <UIcon name="i-lucide-file" class="size-5 shrink-0 text-muted" />
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-default">{{ file.name }}</p>
              <p class="text-xs text-muted">{{ formatBytes(file.size) }}</p>
            </div>
            <UButton
              size="xs"
              variant="ghost"
              color="error"
              icon="i-lucide-x"
              aria-label="Remove"
              @click="removePending(i)"
            />
          </li>
        </ul>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <div class="flex items-center gap-2">
          <UButton
            v-if="initial && canDelete && canEdit"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            label="Delete"
            @click="emit('delete', initial)"
          />
        </div>
        <div class="ml-auto flex gap-3">
          <template v-if="initial && !editMode">
            <UButton variant="ghost" label="Close" @click="emit('update:open', false)" />
            <UButton
              v-if="canEdit"
              icon="i-lucide-pencil"
              label="Edit details"
              @click="editMode = true"
            />
          </template>
          <template v-else>
            <UButton
              variant="ghost"
              :label="initial ? 'Cancel' : 'Discard'"
              @click="initial ? cancelEdit() : emit('update:open', false)"
            />
            <UButton
              v-if="canEdit"
              type="submit"
              form="opportunity-form"
              :loading="submitting"
              :label="initial ? 'Save changes' : 'Create opportunity'"
              trailing-icon="i-lucide-check"
            />
          </template>
        </div>
      </div>
    </template>
  </UModal>

  <!-- Status-change dialog. Reject requires a reason; the API persists it into
       the comments thread automatically. -->
  <UModal
    :open="pendingStatus !== null"
    :title="
      pendingStatus && initial
        ? `Mark “${initial.title}” as ${OPPORTUNITY_STATUS_LABEL[pendingStatus]}?`
        : 'Change status?'
    "
    @update:open="(v: boolean) => !v && cancelStatusChange()"
  >
    <template #body>
      <div class="space-y-3">
        <UAlert
          v-if="pendingStatus === 'accepted'"
          color="success"
          variant="subtle"
          icon="i-lucide-rocket"
          title="A proposal will be created"
          description="Accepting this opportunity auto-creates a Proposal in 'Writing' state, so the bid team can start work."
        />
        <p class="text-sm text-muted">
          {{
            pendingStatus === 'rejected'
              ? 'A reason is required when rejecting an opportunity — it goes into the comments thread so other reviewers can see why.'
              : pendingStatus === 'accepted'
                ? 'Add an optional note about why this opportunity is worth pursuing.'
                : 'Add an optional note (it will appear in the comments thread).'
          }}
        </p>
        <UFormField
          :label="pendingStatus === 'rejected' ? 'Rejection reason' : 'Comment'"
          :required="pendingStatus === 'rejected'"
        >
          <UTextarea
            v-model="transitionComment"
            :rows="4"
            :placeholder="
              pendingStatus === 'rejected'
                ? 'e.g. Budget too small; did not meet eligibility criteria'
                : 'Optional context'
            "
            class="w-full"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="ml-auto flex gap-3">
        <UButton variant="ghost" label="Cancel" @click="cancelStatusChange" />
        <UButton
          :disabled="pendingStatus === 'rejected' && !transitionComment.trim()"
          :color="
            pendingStatus === 'rejected'
              ? 'error'
              : pendingStatus === 'accepted'
                ? 'success'
                : 'primary'
          "
          :label="
            pendingStatus === 'rejected'
              ? 'Mark as Rejected'
              : pendingStatus === 'accepted'
                ? 'Accept'
                : 'Confirm'
          "
          @click="confirmStatusChange"
        />
      </div>
    </template>
  </UModal>
</template>
