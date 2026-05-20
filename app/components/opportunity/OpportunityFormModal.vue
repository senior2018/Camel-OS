<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  OPPORTUNITY_SOURCES,
  OPPORTUNITY_SOURCE_LABEL,
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_TYPE_LABEL,
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
  'move-stage': [opp: Opportunity, toStage: OpportunityStage]
}>()

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
  winProbability: number | null
  ownerUserId: string | null
}>({
  title: '',
  source: 'other',
  type: 'consulting',
  deadline: '',
  estimatedValue: '',
  currency: 'USD',
  winProbability: null,
  ownerUserId: null,
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

const ownerOptions = computed(() => [
  { label: 'Unassigned', value: null as string | null },
  ...(teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id as string | null,
  })),
])

const sourceOptions = OPPORTUNITY_SOURCES.map((s) => ({
  label: OPPORTUNITY_SOURCE_LABEL[s],
  value: s,
}))
const typeOptions = OPPORTUNITY_TYPES.map((t) => ({
  label: OPPORTUNITY_TYPE_LABEL[t],
  value: t,
}))

watch(
  () => [props.open, props.initial] as const,
  ([open, initial]) => {
    if (!open) return
    pendingFiles.value = []
    if (initial) {
      state.title = initial.title
      state.source = initial.source
      state.type = initial.type
      state.deadline = initial.deadline ?? ''
      state.estimatedValue = initial.estimatedValue ?? ''
      state.currency = initial.currency
      state.winProbability = initial.winProbability
      state.ownerUserId = initial.ownerUserId
    } else {
      state.title = ''
      state.source = 'other'
      state.type = 'consulting'
      state.deadline = ''
      state.estimatedValue = ''
      state.currency = 'USD'
      state.winProbability = null
      state.ownerUserId = null
    }
  },
  { immediate: true }
)

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
      winProbability: state.winProbability,
      ownerUserId: state.ownerUserId,
    },
    props.initial?.id ?? null,
    props.initial ? [] : pendingFiles.value
  )
}
</script>

<template>
  <UModal
    :open="open"
    :title="readOnly ? 'Opportunity details' : initial ? 'Edit opportunity' : 'New opportunity'"
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
          @update:model-value="
            (s: OpportunityStage) =>
              initial && s !== initial.stage && emit('move-stage', initial, s)
          "
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
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Source" name="source" required>
          <USelectMenu
            v-model="state.source"
            :items="sourceOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Type" name="type" required>
          <USelectMenu
            v-model="state.type"
            :items="typeOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Deadline" name="deadline">
          <UInput
            v-model="state.deadline"
            type="date"
            size="lg"
            class="w-full"
            :disabled="readOnly"
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
              :disabled="readOnly"
            />
            <UInput
              v-model="state.currency"
              maxlength="3"
              size="lg"
              class="w-20"
              :disabled="readOnly"
            />
          </div>
        </UFormField>

        <UFormField label="Win probability (%)" name="winProbability">
          <UInputNumber
            v-model="state.winProbability"
            :min="0"
            :max="100"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Owner" name="ownerUserId">
          <USelectMenu
            v-model="state.ownerUserId"
            :items="ownerOptions"
            value-key="value"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>
      </UForm>

      <!-- Existing opportunity: live attachment list. -->
      <div v-if="initial" class="mt-6 border-t border-default pt-6">
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
          <UButton
            variant="ghost"
            :label="readOnly ? 'Close' : 'Cancel'"
            @click="emit('update:open', false)"
          />
          <UButton
            v-if="!readOnly"
            type="submit"
            form="opportunity-form"
            :loading="submitting"
            :label="initial ? 'Save changes' : 'Create opportunity'"
            trailing-icon="i-lucide-check"
          />
        </div>
      </div>
    </template>
  </UModal>
</template>
