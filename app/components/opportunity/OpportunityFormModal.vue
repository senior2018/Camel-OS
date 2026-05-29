<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  createOpportunitySchema,
  type CreateOpportunityPayload,
  type OpportunitySource,
  type OpportunityStage,
  type OpportunityType,
} from '@@/shared/schemas/opportunity'
import type { Opportunity } from '@/composables/useOpportunities'

interface Props {
  open: boolean
  initial: Opportunity | null
  submitting?: boolean
  canDelete?: boolean
  readOnly?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:open': [value: boolean]
  submit: [payload: CreateOpportunityPayload, id: string | null, pendingFiles: File[]]
  delete: [opp: Opportunity]
  approve: [opp: Opportunity, approved: boolean]
  // S5b: stage moves now carry a comment (required for 'lost', optional otherwise).
  'move-stage': [opp: Opportunity, toStage: OpportunityStage, comment: string | null]
}>()

// S5b — view-by-default for existing opportunities. The form fields are
// rendered disabled until the user explicitly clicks "Edit details"; this
// prevents accidental mutations while still showing all the information
// clearly. New opportunities open straight into edit mode (no existing data
// to view). The workflow checklist + attachments + stage selector live
// outside this gate because they're discrete actions, not form mutations.
const editMode = ref(false)

// Buffered stage transition: the dropdown changes a *pending* value, then
// opens the dialog. Only when the user confirms (with a comment if needed)
// do we emit `move-stage` to the parent.
const pendingStage = ref<OpportunityStage | null>(null)
const transitionComment = ref('')

function startTransition(s: OpportunityStage) {
  if (!props.initial) return
  if (s === props.initial.stage) return
  pendingStage.value = s
  transitionComment.value = ''
}

function cancelTransition() {
  pendingStage.value = null
  transitionComment.value = ''
}

function confirmTransition() {
  if (!props.initial || !pendingStage.value) return
  const target = pendingStage.value
  if (target === 'lost' && !transitionComment.value.trim()) {
    return // dialog UI shows the required-field hint
  }
  emit('move-stage', props.initial, target, transitionComment.value.trim() || null)
  pendingStage.value = null
  transitionComment.value = ''
}

const stageOptions = OPPORTUNITY_STAGES.map((s) => ({
  label: OPPORTUNITY_STAGE_LABEL[s],
  value: s,
}))

const isApproved = computed(() => !!props.initial?.approvedToPursueAt)

const state = reactive<{
  title: string
  source: OpportunitySource
  type: OpportunityType
  deadline: string
  estimatedValue: string
  currency: string
  ownerUserId: string | null
  primaryClientId: string | null
}>({
  title: '',
  source: 'other',
  type: 'consulting',
  deadline: '',
  estimatedValue: '',
  currency: 'USD',
  ownerUserId: null,
  primaryClientId: null,
})

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

// Client roster for the primary-client picker (CR-03).
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

// S5b — source + type options come from the org's admin-editable lookup table.
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
    state.source = props.initial.source
    state.type = props.initial.type
    state.deadline = props.initial.deadline ?? ''
    state.estimatedValue = props.initial.estimatedValue ?? ''
    state.currency = props.initial.currency
    state.ownerUserId = props.initial.ownerUserId
    state.primaryClientId = props.initial.primaryClientId
  } else {
    state.title = ''
    state.source = 'other'
    state.type = 'consulting'
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
    // New opportunities open in edit mode (there's nothing to view yet);
    // existing ones open in view mode so admins can't accidentally mutate.
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
    :title="
      !initial
        ? 'New opportunity'
        : readOnly
          ? 'Opportunity details'
          : editMode
            ? 'Edit opportunity'
            : 'Opportunity details'
    "
    :ui="{ content: 'sm:max-w-2xl' }"
    @update:open="emit('update:open', $event)"
  >
    <template #body>
      <UAlert
        v-if="readOnly"
        color="neutral"
        variant="subtle"
        icon="i-lucide-eye"
        title="View only"
        description="You don't have permission to edit opportunities. Contact your administrator to request access."
        class="mb-4"
      />

      <div
        v-if="initial && !readOnly"
        class="mb-4 flex flex-col gap-2 rounded-lg border border-default bg-elevated/40 p-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div class="flex items-center gap-2 text-sm">
          <UIcon name="i-lucide-layers" class="size-4 text-muted" />
          <span class="text-muted">Stage</span>
          <UBadge variant="subtle" color="primary" size="sm">
            {{ OPPORTUNITY_STAGE_LABEL[initial.stage] }}
          </UBadge>
        </div>
        <USelectMenu
          :model-value="initial.stage"
          :items="stageOptions"
          value-key="value"
          size="sm"
          class="w-full sm:w-48"
          @update:model-value="(s: OpportunityStage) => startTransition(s)"
        />
      </div>

      <UForm
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
            :disabled="readOnly || !editMode"
          />
        </UFormField>

        <UFormField label="Source" name="source" required>
          <USelectMenu
            v-model="state.source"
            :items="sourceOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly || !editMode"
          />
        </UFormField>

        <UFormField label="Type" name="type" required>
          <USelectMenu
            v-model="state.type"
            :items="typeOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly || !editMode"
          />
        </UFormField>

        <UFormField label="Deadline" name="deadline">
          <UInput
            v-model="state.deadline"
            type="date"
            size="lg"
            class="w-full"
            :disabled="readOnly || !editMode"
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
              :disabled="readOnly || !editMode"
            />
            <UInput
              v-model="state.currency"
              maxlength="3"
              size="lg"
              class="w-20"
              :disabled="readOnly || !editMode"
            />
          </div>
        </UFormField>

        <UFormField label="Assigned to" name="ownerUserId">
          <USelectMenu
            v-model="state.ownerUserId"
            :items="ownerOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly || !editMode"
          />
        </UFormField>

        <UFormField label="Primary client" name="primaryClientId" class="sm:col-span-2">
          <USelectMenu
            v-model="state.primaryClientId"
            :items="clientOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly || !editMode"
          />
        </UFormField>
      </UForm>

      <!-- Existing opportunity: stage-aware workflow panel + live attachments. -->
      <div v-if="initial" class="mt-6 space-y-6 border-t border-default pt-6">
        <OpportunityWorkflowPanel :opportunity-id="initial.id" :can-edit="!readOnly" />
        <OpportunityAttachments
          :opportunity-id="initial.id"
          :can-upload="!readOnly"
          :can-delete="!readOnly && canDelete"
        />
      </div>

      <!-- New opportunity: buffer files client-side; upload after create. -->
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
          <!-- Approval + Delete always available on an existing opp (when the
               user has permission) — they're discrete actions, not form mutations. -->
          <UButton
            v-if="initial && !readOnly"
            :color="isApproved ? 'warning' : 'success'"
            variant="soft"
            :icon="isApproved ? 'i-lucide-circle-x' : 'i-lucide-circle-check'"
            :label="isApproved ? 'Revoke approval' : 'Approve to pursue'"
            @click="emit('approve', initial, !isApproved)"
          />
          <UButton
            v-if="initial && canDelete && !readOnly"
            color="error"
            variant="ghost"
            icon="i-lucide-trash-2"
            label="Delete"
            @click="emit('delete', initial)"
          />
        </div>
        <div class="ml-auto flex gap-3">
          <!-- VIEW mode on an existing opp: Close + Edit details -->
          <template v-if="initial && !editMode">
            <UButton variant="ghost" label="Close" @click="emit('update:open', false)" />
            <UButton
              v-if="!readOnly"
              icon="i-lucide-pencil"
              label="Edit details"
              @click="editMode = true"
            />
          </template>
          <!-- EDIT mode (or new opp): Cancel + Save / Create -->
          <template v-else>
            <UButton
              variant="ghost"
              :label="initial ? 'Cancel' : 'Discard'"
              @click="initial ? cancelEdit() : emit('update:open', false)"
            />
            <UButton
              v-if="!readOnly"
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

  <!-- Stage-transition confirmation. Opens when the user picks a new stage in
       the header dropdown. Captures an optional comment (required when moving
       to Lost). The actual move only fires on Confirm. -->
  <UModal
    :open="pendingStage !== null"
    :title="
      pendingStage && initial
        ? `Move “${initial.title}” to ${OPPORTUNITY_STAGE_LABEL[pendingStage]}?`
        : 'Move stage?'
    "
    @update:open="(v: boolean) => !v && cancelTransition()"
  >
    <template #body>
      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{
            pendingStage === 'lost'
              ? 'A rejection reason is required when marking an opportunity as Lost.'
              : pendingStage === 'won'
                ? 'Capture any notes about how the win was secured (optional).'
                : 'Add a short note about why you’re moving this opportunity (optional).'
          }}
        </p>
        <UFormField
          :label="pendingStage === 'lost' ? 'Rejection reason' : 'Comment'"
          :required="pendingStage === 'lost'"
        >
          <UTextarea
            v-model="transitionComment"
            :rows="4"
            :placeholder="
              pendingStage === 'lost'
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
        <UButton variant="ghost" label="Cancel" @click="cancelTransition" />
        <UButton
          :disabled="pendingStage === 'lost' && !transitionComment.trim()"
          :color="pendingStage === 'lost' ? 'error' : 'primary'"
          :label="pendingStage === 'lost' ? 'Mark as Lost' : 'Confirm move'"
          @click="confirmTransition"
        />
      </div>
    </template>
  </UModal>
</template>
