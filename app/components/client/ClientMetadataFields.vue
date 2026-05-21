<script setup lang="ts">
import {
  PARTNERSHIP_TYPES,
  PARTNERSHIP_TYPE_LABEL,
  type ClientMetadata,
  type ClientType,
} from '@@/shared/schemas/client'

interface Props {
  type: ClientType
  modelValue: ClientMetadata | null
  disabled?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: ClientMetadata]
}>()

// Convert focusAreas[] ⇄ comma-separated string for a simple input. Avoids
// pulling in a TagInput just for this one field.
const focusAreasText = computed({
  get(): string {
    return (props.modelValue?.focusAreas ?? []).join(', ')
  },
  set(v: string) {
    const parts = v
      .split(',')
      .map((s) => s.trim())
      .filter((s) => s.length > 0)
    emit('update:modelValue', { ...(props.modelValue ?? {}), focusAreas: parts })
  },
})

function setField<K extends keyof NonNullable<ClientMetadata>>(
  key: K,
  value: NonNullable<ClientMetadata>[K]
) {
  emit('update:modelValue', { ...(props.modelValue ?? {}), [key]: value })
}

const partnershipOptions = PARTNERSHIP_TYPES.map((p) => ({
  label: PARTNERSHIP_TYPE_LABEL[p],
  value: p,
}))
</script>

<template>
  <template v-if="type === 'donor'">
    <UFormField label="Focus areas" name="focusAreas" class="sm:col-span-2">
      <UInput
        v-model="focusAreasText"
        placeholder="Health, Education, Water"
        size="lg"
        class="w-full"
        :disabled="disabled"
      />
    </UFormField>
    <UFormField label="Reporting language" name="reportingLanguage">
      <UInput
        :model-value="modelValue?.reportingLanguage ?? ''"
        placeholder="English"
        size="lg"
        class="w-full"
        :disabled="disabled"
        @update:model-value="(v: string | number) => setField('reportingLanguage', String(v))"
      />
    </UFormField>
    <UFormField label="Fiscal year start (MM-DD)" name="fiscalYearStart">
      <UInput
        :model-value="modelValue?.fiscalYearStart ?? ''"
        placeholder="07-01"
        size="lg"
        class="w-full"
        :disabled="disabled"
        @update:model-value="(v: string | number) => setField('fiscalYearStart', String(v))"
      />
    </UFormField>
  </template>

  <template v-else-if="type === 'partner'">
    <UFormField label="Partnership type" name="partnershipType">
      <USelectMenu
        :model-value="modelValue?.partnershipType ?? 'other'"
        :items="partnershipOptions"
        value-key="value"
        size="lg"
        class="w-full"
        :disabled="disabled"
        @update:model-value="(v) => setField('partnershipType', v)"
      />
    </UFormField>
    <UFormField label="Scope" name="scope" class="sm:col-span-2">
      <UTextarea
        :model-value="modelValue?.scope ?? ''"
        placeholder="Geographic focus, thematic areas, joint deliverables…"
        :rows="3"
        class="w-full"
        :disabled="disabled"
        @update:model-value="(v: string | number) => setField('scope', String(v))"
      />
    </UFormField>
  </template>
</template>
