<script setup lang="ts">
import {
  OPPORTUNITY_STAGES,
  OPPORTUNITY_STAGE_LABEL,
  type OpportunitySource,
  type OpportunityStage,
  type OpportunityType,
} from '@@/shared/schemas/opportunity'

/**
 * Filter state for the opportunities page (OM-04).
 * Stays as a plain reactive bag rather than a Zod schema because none of these
 * fields ever cross the wire — filtering is fully client-side over the small
 * per-org dataset.
 */
export interface OpportunityFilterState {
  search: string
  sources: OpportunitySource[]
  types: OpportunityType[]
  stages: OpportunityStage[]
  deadlineFrom: string
  deadlineTo: string
  valueMin: number | null
  valueMax: number | null
}

interface Props {
  modelValue: OpportunityFilterState
}

const props = defineProps<Props>()
const emit = defineEmits<{
  'update:modelValue': [value: OpportunityFilterState]
}>()

const state = reactive<OpportunityFilterState>({ ...props.modelValue })

watch(
  () => props.modelValue,
  (v) => Object.assign(state, v)
)

function push() {
  emit('update:modelValue', { ...state })
}

watch(state, push, { deep: true })

// S5b — source + type come from admin-editable lookup values.
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
const stageOptions = OPPORTUNITY_STAGES.map((s) => ({
  label: OPPORTUNITY_STAGE_LABEL[s],
  value: s,
}))

const activeCount = computed(() => {
  let n = 0
  if (state.search.trim()) n++
  if (state.sources.length) n++
  if (state.types.length) n++
  if (state.stages.length) n++
  if (state.deadlineFrom) n++
  if (state.deadlineTo) n++
  if (state.valueMin !== null) n++
  if (state.valueMax !== null) n++
  return n
})

function clearAll() {
  state.search = ''
  state.sources = []
  state.types = []
  state.stages = []
  state.deadlineFrom = ''
  state.deadlineTo = ''
  state.valueMin = null
  state.valueMax = null
}
</script>

<template>
  <UCard :ui="{ body: 'p-4' }">
    <div class="space-y-3">
      <div class="flex items-center gap-3">
        <UInput
          v-model="state.search"
          icon="i-lucide-search"
          placeholder="Search by title…"
          size="md"
          class="flex-1"
        />
        <UBadge v-if="activeCount" variant="subtle" color="primary" size="sm">
          {{ activeCount }} active
        </UBadge>
        <UButton
          v-if="activeCount"
          size="sm"
          variant="ghost"
          icon="i-lucide-x"
          label="Clear"
          @click="clearAll"
        />
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UFormField label="Stage">
          <USelectMenu
            v-model="state.stages"
            :items="stageOptions"
            value-key="value"
            multiple
            placeholder="Any stage"
            size="md"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Source">
          <USelectMenu
            v-model="state.sources"
            :items="sourceOptions"
            value-key="value"
            multiple
            placeholder="Any source"
            size="md"
            class="w-full"
          />
        </UFormField>
        <UFormField label="Type">
          <USelectMenu
            v-model="state.types"
            :items="typeOptions"
            value-key="value"
            multiple
            placeholder="Any type"
            size="md"
            class="w-full"
          />
        </UFormField>

        <UFormField label="Deadline from">
          <UInput v-model="state.deadlineFrom" type="date" size="md" class="w-full" />
        </UFormField>
        <UFormField label="Deadline to">
          <UInput v-model="state.deadlineTo" type="date" size="md" class="w-full" />
        </UFormField>

        <UFormField label="Value range">
          <div class="flex items-center gap-2">
            <UInputNumber v-model="state.valueMin" placeholder="Min" class="flex-1" />
            <span class="text-xs text-muted">–</span>
            <UInputNumber v-model="state.valueMax" placeholder="Max" class="flex-1" />
          </div>
        </UFormField>
      </div>
    </div>
  </UCard>
</template>
