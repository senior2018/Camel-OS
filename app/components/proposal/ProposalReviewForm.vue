<script setup lang="ts">
import {
  PROPOSAL_REVIEWER_STATUS_COLOR,
  PROPOSAL_REVIEWER_STATUS_LABEL,
} from '@@/shared/schemas/proposal-review'

const props = defineProps<{
  proposalId: string
  proposalTitle: string
}>()

const emit = defineEmits<{ changed: [] }>()

const toast = useToast()
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)

const { reviewers, submitReview } = useProposalReview(computed(() => props.proposalId))

const myReview = computed(() =>
  reviewers.value.find((r) => r.reviewerUserId === currentUserId.value)
)
const alreadyDecided = computed(() => !!myReview.value && myReview.value.status !== 'pending')

type Decision = 'approved' | 'changes_required' | 'rejected'
const decision = ref<Decision | null>(null)
const feedback = ref('')
const saving = ref(false)

const options: Array<{
  value: Decision
  label: string
  hint: string
  color: string
  active: string
}> = [
  {
    value: 'approved',
    label: 'Approve',
    hint: 'Ready to proceed',
    color: 'border-success/40',
    active: 'border-success bg-success/5',
  },
  {
    value: 'changes_required',
    label: 'Changes Required',
    hint: 'Send back for revision',
    color: 'border-warning/40',
    active: 'border-warning bg-warning/5',
  },
  {
    value: 'rejected',
    label: 'Reject',
    hint: 'Should not proceed',
    color: 'border-error/40',
    active: 'border-error bg-error/5',
  },
]

async function submit() {
  if (!decision.value) {
    toast.add({ title: 'Pick a decision', color: 'warning' })
    return
  }
  if (!feedback.value.trim()) {
    toast.add({ title: 'Feedback is required', color: 'warning' })
    return
  }
  saving.value = true
  const ok = await submitReview({ status: decision.value, feedback: feedback.value.trim() })
  saving.value = false
  if (ok) {
    decision.value = null
    feedback.value = ''
    emit('changed')
  }
}
</script>

<template>
  <UCard v-if="myReview">
    <template #header>
      <h3 class="text-sm font-semibold text-default">Your review</h3>
    </template>

    <!-- Already submitted -->
    <div v-if="alreadyDecided" class="space-y-2">
      <div class="flex items-center justify-between rounded-lg bg-default/30 p-3">
        <span class="text-sm text-muted">Your decision</span>
        <UBadge
          :color="PROPOSAL_REVIEWER_STATUS_COLOR[myReview.status]"
          variant="subtle"
          :label="PROPOSAL_REVIEWER_STATUS_LABEL[myReview.status]"
        />
      </div>
      <div v-if="myReview.feedback" class="rounded-lg border border-default bg-default/30 p-3">
        <p class="text-xs font-medium text-muted">Your feedback</p>
        <p class="mt-1 whitespace-pre-wrap text-sm text-default">{{ myReview.feedback }}</p>
      </div>
    </div>

    <!-- Pending: decision form -->
    <div v-else class="space-y-4">
      <p class="text-sm text-muted">
        Review <strong>{{ proposalTitle }}</strong> and record your decision.
      </p>

      <div class="grid gap-2">
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="rounded-lg border-2 p-3 text-left transition-all"
          :class="decision === opt.value ? opt.active : opt.color"
          @click="decision = opt.value"
        >
          <p class="text-sm font-medium text-default">{{ opt.label }}</p>
          <p class="text-xs text-muted">{{ opt.hint }}</p>
        </button>
      </div>

      <UFormField label="Feedback">
        <UTextarea
          v-model="feedback"
          :rows="4"
          placeholder="Explain your decision…"
          class="w-full"
        />
      </UFormField>

      <UButton :loading="saving" icon="i-lucide-send" label="Submit review" @click="submit" />
    </div>
  </UCard>
</template>
