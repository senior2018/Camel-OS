<script setup lang="ts">
import { PROPOSAL_REVIEWER_STATUS_LABEL } from '@@/shared/schemas/proposal-review'
import type { ProposalReviewerStatus } from '@@/shared/schemas/proposal-review'

interface Props {
  proposalId: string
  proposalTitle: string
}

defineProps<Props>()

const { reviewers, submitReview } = useProposalReview(computed(() => props.proposalId))
const props = defineProps<Props>()

const reviewDecision = ref<'approved' | 'changes_required' | 'rejected' | null>(null)
const feedback = ref('')
const submitting = ref(false)

const currentUserReviewer = computed(() =>
  reviewers.value.find((r) => r.reviewerUserId === useAuthStore().user?.id)
)

const hasAlreadyReviewed = computed(() => currentUserReviewer.value?.status !== 'pending')

async function submitMyReview() {
  if (!reviewDecision.value) {
    useToast().add({
      title: 'Please select a decision',
      color: 'warning',
    })
    return
  }

  if (!feedback.value.trim()) {
    useToast().add({
      title: 'Feedback is required',
      color: 'warning',
    })
    return
  }

  submitting.value = true
  const ok = await submitReview({
    status: reviewDecision.value,
    feedback: feedback.value,
  })
  if (ok) {
    reviewDecision.value = null
    feedback.value = ''
  }
  submitting.value = false
}
</script>

<template>
  <div v-if="currentUserReviewer">
    <UCard v-if="hasAlreadyReviewed">
      <template #header>
        <h3 class="font-semibold text-default">Your Review</h3>
      </template>

      <div class="space-y-2">
        <div class="flex items-center justify-between rounded-lg bg-default/30 p-3">
          <span class="text-sm text-muted">Your decision:</span>
          <UBadge :color="currentUserReviewer.status === 'approved' ? 'success' : currentUserReviewer.status === 'rejected' ? 'error' : 'warning'" variant="subtle">
            {{ PROPOSAL_REVIEWER_STATUS_LABEL[currentUserReviewer.status as ProposalReviewerStatus] }}
          </UBadge>
        </div>

        <div v-if="currentUserReviewer.feedback" class="rounded-lg border border-default bg-default/30 p-3">
          <p class="text-xs font-medium text-muted">Your feedback</p>
          <p class="mt-2 text-sm text-default">{{ currentUserReviewer.feedback }}</p>
        </div>

        <p class="text-xs text-muted">
          Reviewed
          {{ new Date(currentUserReviewer.decidedAt!).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) }}
        </p>
      </div>
    </UCard>

    <UCard v-else>
      <template #header>
        <h3 class="font-semibold text-default">Your Review</h3>
      </template>

      <div class="space-y-4">
        <p class="text-sm text-muted">
          Please review "<strong>{{ proposalTitle }}</strong>" and provide your decision.
        </p>

        <!-- Decision options -->
        <div class="space-y-2">
          <!-- Approve -->
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all" :class="reviewDecision === 'approved' ? 'border-success bg-success/5' : 'border-default hover:border-success/40'">
            <URadio
              v-model="reviewDecision"
              value="approved"
              class="mt-0.5"
            />
            <div>
              <p class="font-medium text-default">Approved</p>
              <p class="text-xs text-muted">The proposal is ready to proceed</p>
            </div>
          </label>

          <!-- Changes Required -->
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all" :class="reviewDecision === 'changes_required' ? 'border-warning bg-warning/5' : 'border-default hover:border-warning/40'">
            <URadio
              v-model="reviewDecision"
              value="changes_required"
              class="mt-0.5"
            />
            <div>
              <p class="font-medium text-default">Changes Required</p>
              <p class="text-xs text-muted">Send back for revisions</p>
            </div>
          </label>

          <!-- Rejected -->
          <label class="flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-all" :class="reviewDecision === 'rejected' ? 'border-error bg-error/5' : 'border-default hover:border-error/40'">
            <URadio
              v-model="reviewDecision"
              value="rejected"
              class="mt-0.5"
            />
            <div>
              <p class="font-medium text-default">Rejected</p>
              <p class="text-xs text-muted">The proposal should not proceed</p>
            </div>
          </label>
        </div>

        <!-- Feedback -->
        <UFormGroup label="Your feedback:">
          <UTextarea
            v-model="feedback"
            placeholder="Explain your decision..."
            rows="4"
          />
        </UFormGroup>

        <!-- Submit -->
        <div class="flex gap-2">
          <UButton
            :loading="submitting"
            @click="submitMyReview"
          >
            <UIcon name="i-lucide-send" class="mr-2 size-4" />
            Submit Review
          </UButton>
        </div>
      </div>
    </UCard>
  </div>
</template>
