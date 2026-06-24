<script setup lang="ts">
import type {
  OpportunitySource,
  OpportunityStatus,
  OpportunityType,
} from '@@/shared/schemas/opportunity'

/**
 * Filter state for the opportunities page (OM-04).
 * Stays as a plain reactive bag rather than a Zod schema because none of these
 * fields ever cross the wire — filtering is fully client-side over the small
 * per-org dataset.
 *
 * S7 — `stages` replaced by `statuses` to mirror the new 3-state pipeline. Tag
 * search is a single string; we OR-match against the row's tags array.
 */
export interface OpportunityFilterState {
  search: string
  sources: OpportunitySource[]
  types: OpportunityType[]
  statuses: OpportunityStatus[]
  tag: string
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

const activeCount = computed(() => {
  let n = 0
  if (state.search.trim()) n++
  if (state.sources.length) n++
  if (state.types.length) n++
  if (state.statuses.length) n++
  if (state.tag.trim()) n++
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
  state.statuses = []
  state.tag = ''
  state.deadlineFrom = ''
  state.deadlineTo = ''
  state.valueMin = null
  state.valueMax = null
}
</script>

<template>
  <UCard :ui="{ body: 'p-4' }">
    <div class="space-y-3">
      <div class="flex items-center justify-between gap-3">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">Advanced filters</p>
        <div class="flex items-center gap-2">
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
      </div>

      <div class="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <UFormField label="Tag">
          <UInput v-model="state.tag" placeholder="e.g. tech" size="md" class="w-full" />
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
