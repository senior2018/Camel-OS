<script setup lang="ts">
import {
  PROPOSAL_REVIEW_RULES,
  PROPOSAL_REVIEW_RULE_LABEL,
  type ProposalReviewRule,
} from '@@/shared/schemas/proposal'

/**
 * P3.3 — per-proposal review policy: how many reviewers are required and how
 * their approvals are tallied (all / at least N / a percentage), plus whether a
 * final approver signs off. Editable by the Lead or a manager.
 */
const props = defineProps<{
  proposalId: string
  minReviewers: number
  rule: ProposalReviewRule
  threshold: number | null
  requireFinalApprover: boolean
  canManage: boolean
}>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()
const minReviewers = ref(props.minReviewers)
const rule = ref<ProposalReviewRule>(props.rule)
const threshold = ref<number | null>(props.threshold ?? (props.rule === 'percent' ? 60 : 2))
const requireFinalApprover = ref(props.requireFinalApprover)
const saving = ref(false)

watch(
  () => [props.minReviewers, props.rule, props.threshold, props.requireFinalApprover],
  () => {
    minReviewers.value = props.minReviewers
    rule.value = props.rule
    threshold.value = props.threshold ?? (props.rule === 'percent' ? 60 : 2)
    requireFinalApprover.value = props.requireFinalApprover
  }
)

const ruleItems = PROPOSAL_REVIEW_RULES.map((r) => ({
  label: PROPOSAL_REVIEW_RULE_LABEL[r],
  value: r,
}))
const showThreshold = computed(() => rule.value !== 'all')

// Plain-language summary of the current policy.
const summary = computed(() => {
  if (rule.value === 'count') return `At least ${threshold.value ?? '?'} reviewer(s) must approve.`
  if (rule.value === 'percent')
    return `At least ${threshold.value ?? '?'}% of reviewers must approve.`
  return 'Every assigned reviewer must approve.'
})

async function save() {
  saving.value = true
  try {
    await $fetch(`/api/proposals/${props.proposalId}/review-policy`, {
      method: 'PUT',
      body: {
        reviewMinReviewers: minReviewers.value,
        reviewRule: rule.value,
        reviewThreshold: rule.value === 'all' ? null : threshold.value,
        requireFinalApprover: requireFinalApprover.value,
      },
    })
    toast.add({ title: 'Review policy saved', color: 'success' })
    emit('changed')
  } catch (err) {
    const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
    toast.add({ title: 'Could not save', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-semibold text-default">Review policy</h3>
    </template>

    <div v-if="canManage" class="space-y-3">
      <UFormField label="Minimum reviewers to send for review">
        <UInputNumber v-model="minReviewers" :min="1" :max="20" class="w-full" />
      </UFormField>
      <UFormField label="Approval rule">
        <USelect v-model="rule" :items="ruleItems" value-key="value" class="w-full" />
      </UFormField>
      <UFormField v-if="showThreshold" :label="rule === 'percent' ? 'Percentage (%)' : 'How many'">
        <UInputNumber
          v-model="threshold"
          :min="1"
          :max="rule === 'percent' ? 100 : 20"
          class="w-full"
        />
      </UFormField>
      <UFormField>
        <USwitch v-model="requireFinalApprover" label="Require a final approver" />
      </UFormField>
      <p class="text-xs text-muted">{{ summary }}</p>
      <UButton size="sm" label="Save policy" :loading="saving" @click="save" />
    </div>

    <div v-else class="space-y-2.5 text-sm">
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-users" class="size-4 shrink-0 text-muted" />
        <span class="text-default">{{ summary }}</span>
      </div>
      <div class="flex items-center gap-2">
        <UIcon name="i-lucide-user-check" class="size-4 shrink-0 text-muted" />
        <span class="text-default">
          Minimum <span class="font-semibold">{{ minReviewers }}</span> reviewer(s)
        </span>
      </div>
      <div class="flex items-center gap-2">
        <UIcon
          :name="requireFinalApprover ? 'i-lucide-shield-check' : 'i-lucide-shield-off'"
          class="size-4 shrink-0"
          :class="requireFinalApprover ? 'text-success' : 'text-muted'"
        />
        <span class="text-default">
          Final approver {{ requireFinalApprover ? 'required' : 'not required' }}
        </span>
      </div>
    </div>
  </UCard>
</template>
