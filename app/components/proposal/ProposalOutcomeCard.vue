<script setup lang="ts">
import { PROPOSAL_STATUS_LABEL, type ProposalStatus } from '@@/shared/schemas/proposal'

/**
 * P3.3b — post-submission evaluation & outcome, via a popup (not a row of
 * buttons). Pick an outcome + an optional note that posts to the conversation;
 * a Lost outcome requires a reason. "In evaluation" carries a free-text stage
 * label (Interview, BAFO, Site visit, …) so the pipeline stays dynamic.
 */
const props = withDefaults(
  defineProps<{
    proposalId: string
    status: ProposalStatus
    evaluationStage: string | null
    canOverride?: boolean
    /** Configured evaluation stages (resolved: proposal → org → defaults). */
    stages?: string[]
  }>(),
  { canOverride: false, stages: () => [] }
)
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()

interface Outcome {
  value: ProposalStatus
  label: string
  needsStage?: boolean
  needsReason?: boolean
  color: string
}
const outcomes = computed<Outcome[]>(() => {
  const base: Outcome[] = [
    { value: 'under_evaluation', label: 'In evaluation', needsStage: true, color: 'info' },
    { value: 'clarification_requested', label: 'Clarification requested', color: 'warning' },
    { value: 'shortlisted', label: 'Shortlisted', color: 'warning' },
    { value: 'won', label: 'Won', color: 'success' },
    { value: 'lost', label: 'Lost', needsReason: true, color: 'error' },
  ]
  if (props.status === 'won') {
    base.push({
      value: 'contract_signed',
      label: 'Contract signed → create project',
      color: 'success',
    })
  }
  return base
})

const FALLBACK_STAGES = ['Under evaluation', 'Shortlisted', 'Interview / Presentation', 'BAFO']
const stageSuggestions = computed(() => (props.stages.length ? props.stages : FALLBACK_STAGES))

const open = ref(false)
const choice = ref<ProposalStatus | null>(null)
const stage = ref('')
const note = ref('')
const saving = ref(false)

const selected = computed(() => outcomes.value.find((o) => o.value === choice.value) ?? null)
const needsReason = computed(() => !!selected.value?.needsReason)
const needsStage = computed(() => !!selected.value?.needsStage)

function start() {
  choice.value = null
  stage.value = props.evaluationStage ?? ''
  note.value = ''
  open.value = true
}

async function submit() {
  if (!choice.value) {
    toast.add({ title: 'Pick an outcome', color: 'warning' })
    return
  }
  if (needsReason.value && !note.value.trim()) {
    toast.add({ title: 'A reason is required', color: 'warning' })
    return
  }
  if (needsStage.value && !stage.value.trim()) {
    toast.add({ title: 'Enter the evaluation stage', color: 'warning' })
    return
  }
  saving.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}`, {
      method: 'PATCH',
      body: {
        status: choice.value,
        evaluationStage: needsStage.value ? stage.value.trim() : undefined,
        note: note.value.trim() || undefined,
      },
    })
    toast.add({ title: 'Outcome updated', color: 'success' })
    open.value = false
    emit('changed')
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not update', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-2">
    <p class="mr-1 text-sm text-default">Evaluation &amp; outcome:</p>
    <UBadge :color="canOverride ? 'neutral' : 'info'" variant="subtle" size="sm">
      {{ evaluationStage || PROPOSAL_STATUS_LABEL[status] }}
    </UBadge>
    <UButton
      size="sm"
      :icon="canOverride ? 'i-lucide-shield-alert' : 'i-lucide-flag'"
      :color="canOverride ? 'warning' : 'primary'"
      :variant="canOverride ? 'soft' : 'solid'"
      :label="canOverride ? 'Override outcome' : 'Update outcome'"
      @click="start"
    />

    <UModal v-model:open="open" title="Update evaluation & outcome">
      <template #body>
        <div class="space-y-4">
          <div class="grid gap-2 sm:grid-cols-2">
            <button
              v-for="o in outcomes"
              :key="o.value"
              type="button"
              class="rounded-lg border-2 p-3 text-left text-sm transition-all"
              :class="
                choice === o.value
                  ? 'border-primary bg-primary/5'
                  : 'border-default hover:border-default/80'
              "
              @click="choice = o.value"
            >
              <span class="font-medium text-default">{{ o.label }}</span>
            </button>
          </div>

          <UFormField v-if="needsStage" label="Evaluation stage">
            <UInput
              v-model="stage"
              placeholder="e.g. Interview, BAFO, Site visit…"
              class="w-full"
            />
            <div class="mt-2 flex flex-wrap gap-1">
              <UButton
                v-for="s in stageSuggestions"
                :key="s"
                size="xs"
                variant="soft"
                color="neutral"
                :label="s"
                @click="stage = s"
              />
            </div>
          </UFormField>

          <UFormField :label="needsReason ? 'Reason (required)' : 'Note (optional)'">
            <UTextarea
              v-model="note"
              :rows="3"
              placeholder="Posts into the proposal conversation…"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" />
          <UButton
            label="Apply"
            :loading="saving"
            :disabled="!choice || (needsReason && !note.trim()) || (needsStage && !stage.trim())"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
