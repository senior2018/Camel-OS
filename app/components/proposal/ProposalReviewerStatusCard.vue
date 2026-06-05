<script setup lang="ts">
import { PROPOSAL_REVIEWER_STATUS_LABEL, PROPOSAL_REVIEWER_STATUS_COLOR } from '@@/shared/schemas/proposal-review'

interface Props {
  proposalId: string
  proposalStatus?: string
}

withDefaults(defineProps<Props>(), {
  proposalStatus: 'drafting',
})

const props = defineProps<Props>()
const { reviewers, refreshReviewers } = useProposalReview(computed(() => props.proposalId))

const requiredReviewers = computed(() => reviewers.value.filter((r) => r.isRequired))
const allApproved = computed(
  () => requiredReviewers.value.length > 0 && requiredReviewers.value.every((r) => r.status === 'approved')
)
const hasRejected = computed(() => reviewers.value.some((r) => r.status === 'rejected'))
const hasChangesRequired = computed(() =>
  reviewers.value.some((r) => r.status === 'changes_required')
)

const statusSummary = computed(() => {
  if (hasRejected.value) return 'One or more reviewers rejected'
  if (hasChangesRequired.value) return 'Changes required from reviewer(s)'
  if (allApproved.value) return 'All reviewers approved'
  return `${reviewers.value.filter((r) => r.status === 'approved').length} of ${requiredReviewers.value.length} approved`
})

const statusColor = computed(() => {
  if (hasRejected.value) return 'error'
  if (hasChangesRequired.value) return 'warning'
  if (allApproved.value) return 'success'
  return 'info'
})
</script>

<template>
  <div v-if="reviewers.length > 0">
    <UCard>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-default">Reviewer Status</h3>
          <UBadge :color="statusColor" variant="subtle">
            {{ statusSummary }}
          </UBadge>
        </div>
      </template>

      <div class="space-y-3">
        <!-- Reviewer list -->
        <div class="space-y-2">
          <div
            v-for="reviewer in reviewers"
            :key="reviewer.id"
            class="flex items-center justify-between rounded-lg border border-default bg-default/30 p-3"
          >
            <div>
              <p class="text-sm font-medium text-default">
                {{ reviewer.userFirstName }} {{ reviewer.userLastName || reviewer.userEmail }}
              </p>
              <p class="text-xs text-muted">{{ reviewer.reviewerRole }}</p>
            </div>

            <div class="flex flex-col items-end gap-1">
              <!-- Status badge -->
              <UBadge
                :color="PROPOSAL_REVIEWER_STATUS_COLOR[reviewer.status]"
                variant="subtle"
                size="sm"
              >
                {{ PROPOSAL_REVIEWER_STATUS_LABEL[reviewer.status] }}
              </UBadge>

              <!-- Feedback preview -->
              <p v-if="reviewer.feedback" class="text-xs text-muted" :title="reviewer.feedback">
                {{ reviewer.feedback.substring(0, 30) }}...
              </p>
            </div>
          </div>
        </div>

        <!-- Feedback details -->
        <div v-if="reviewers.some((r) => r.feedback)" class="border-t border-default pt-3 space-y-2">
          <p class="text-xs font-medium uppercase text-muted">Feedback</p>
          <div v-for="reviewer in reviewers.filter((r) => r.feedback)" :key="reviewer.id" class="rounded-lg border-l-2 border-warning bg-warning/5 p-2 pl-3 text-xs">
            <p class="font-medium text-default">{{ reviewer.userFirstName }}:</p>
            <p class="mt-1 text-muted">{{ reviewer.feedback }}</p>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="reviewers.length === 0" class="text-center text-sm text-muted py-4">
          No reviewers assigned yet
        </div>
      </div>
    </UCard>
  </div>
</template>
