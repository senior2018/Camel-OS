<script setup lang="ts">
import {
  CONTENT_REVIEW_RULES,
  CONTENT_REVIEW_RULE_LABEL,
  DEFAULT_CONTENT_REVIEW_POLICY,
  type ContentReviewPolicy,
  type ContentReviewRule,
} from '@@/shared/schemas/communication-settings'

/**
 * CC review policy — mirrors the proposal ProposalReviewPolicyCard. Reviewers
 * read, comment, and approve; this decides how many approvals are needed and
 * whether the Communications Lead must give the final sign-off before publish.
 * Editable by a leader/admin; read-only summary otherwise.
 */
const props = defineProps<{ canManage: boolean }>()

const toast = useToast()
const { data, refresh } = await useFetch<{ policy: ContentReviewPolicy }>(
  '/api/communications/settings/review-policy',
  { key: 'comms-review-policy', default: () => ({ policy: { ...DEFAULT_CONTENT_REVIEW_POLICY } }) }
)

const minReviewers = ref(DEFAULT_CONTENT_REVIEW_POLICY.reviewMinReviewers)
const rule = ref<ContentReviewRule>(DEFAULT_CONTENT_REVIEW_POLICY.reviewRule)
const threshold = ref<number | null>(2)
const requireFinalApprover = ref(DEFAULT_CONTENT_REVIEW_POLICY.requireFinalApprover)
const saving = ref(false)

watchEffect(() => {
  const p = data.value?.policy
  if (p) {
    minReviewers.value = p.reviewMinReviewers
    rule.value = p.reviewRule
    threshold.value = p.reviewThreshold ?? (p.reviewRule === 'percent' ? 60 : 2)
    requireFinalApprover.value = p.requireFinalApprover
  }
})

const ruleItems = CONTENT_REVIEW_RULES.map((r) => ({
  label: CONTENT_REVIEW_RULE_LABEL[r],
  value: r,
}))
const showThreshold = computed(() => rule.value !== 'all')

const summary = computed(() => {
  if (rule.value === 'count') return `At least ${threshold.value ?? '?'} reviewer(s) must approve.`
  if (rule.value === 'percent')
    return `At least ${threshold.value ?? '?'}% of reviewers must approve.`
  return 'Every assigned reviewer must approve.'
})

async function save() {
  saving.value = true
  try {
    await $fetch('/api/communications/settings/review-policy', {
      method: 'PUT',
      body: {
        reviewMinReviewers: minReviewers.value,
        reviewRule: rule.value,
        reviewThreshold: rule.value === 'all' ? null : threshold.value,
        requireFinalApprover: requireFinalApprover.value,
      },
    })
    toast.add({ title: 'Review policy saved', color: 'success' })
    await refresh()
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
      <div>
        <h3 class="text-sm font-semibold text-default">Review policy</h3>
        <p class="mt-0.5 text-xs text-muted">
          How many reviewers must approve before the Communications Lead can publish.
        </p>
      </div>
    </template>

    <div v-if="props.canManage" class="space-y-3">
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
        <USwitch
          v-model="requireFinalApprover"
          label="Require the Communications Lead to give final approval (publish)"
        />
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
          Final approver
          {{ requireFinalApprover ? 'required (Communications Lead)' : 'not required' }}
        </span>
      </div>
    </div>
  </UCard>
</template>
