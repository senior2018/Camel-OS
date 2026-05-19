<script setup lang="ts">
import type { FormSubmitEvent } from '@nuxt/ui'
import {
  OPPORTUNITY_SOURCES,
  OPPORTUNITY_SOURCE_LABEL,
  OPPORTUNITY_TYPES,
  OPPORTUNITY_TYPE_LABEL,
  createOpportunitySchema,
  type CreateOpportunityPayload,
  type OpportunitySource,
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
  submit: [payload: CreateOpportunityPayload, id: string | null]
  delete: [opp: Opportunity]
}>()

const state = reactive<{
  title: string
  description: string
  source: OpportunitySource
  type: OpportunityType
  deadline: string
  estimatedValue: string
  currency: string
  winProbability: number | null
  tagsInput: string
}>({
  title: '',
  description: '',
  source: 'other',
  type: 'consulting',
  deadline: '',
  estimatedValue: '',
  currency: 'USD',
  winProbability: null,
  tagsInput: '',
})

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
    if (initial) {
      state.title = initial.title
      state.description = initial.description ?? ''
      state.source = initial.source
      state.type = initial.type
      state.deadline = initial.deadline ?? ''
      state.estimatedValue = initial.estimatedValue ?? ''
      state.currency = initial.currency
      state.winProbability = initial.winProbability
      state.tagsInput = (initial.tags ?? []).join(', ')
    } else {
      state.title = ''
      state.description = ''
      state.source = 'other'
      state.type = 'consulting'
      state.deadline = ''
      state.estimatedValue = ''
      state.currency = 'USD'
      state.winProbability = null
      state.tagsInput = ''
    }
  },
  { immediate: true }
)

function onSubmit(_e: FormSubmitEvent<unknown>) {
  const tags = state.tagsInput
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)

  emit(
    'submit',
    {
      title: state.title,
      description: state.description || null,
      source: state.source,
      type: state.type,
      deadline: state.deadline || null,
      estimatedValue: state.estimatedValue || null,
      currency: state.currency,
      winProbability: state.winProbability,
      tags,
      ownerUserId: props.initial?.ownerUserId ?? null,
    },
    props.initial?.id ?? null
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

        <UFormField label="Tags" name="tagsInput" class="sm:col-span-2">
          <UInput
            v-model="state.tagsInput"
            placeholder="e.g. health, eastafrica, undp (comma-separated)"
            size="lg"
            class="w-full"
            :disabled="readOnly"
          />
        </UFormField>

        <UFormField label="Description" name="description" class="sm:col-span-2">
          <UTextarea v-model="state.description" :rows="3" class="w-full" :disabled="readOnly" />
        </UFormField>
      </UForm>
    </template>
    <template #footer>
      <div class="flex items-center justify-between gap-3">
        <UButton
          v-if="initial && canDelete && !readOnly"
          color="error"
          variant="ghost"
          icon="i-lucide-trash-2"
          label="Delete"
          @click="emit('delete', initial)"
        />
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
