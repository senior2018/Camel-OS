<script setup lang="ts">
import {
  PROPOSAL_REVIEWER_STATUS_COLOR,
  PROPOSAL_REVIEWER_STATUS_LABEL,
} from '@@/shared/schemas/proposal-review'
import { PROPOSAL_ASSIGNMENT_ROLE_LABEL } from '@@/shared/schemas/proposal-assignment'

const props = defineProps<{ proposalId: string }>()

const { reviewers } = useProposalReview(computed(() => props.proposalId))

const required = computed(() => reviewers.value.filter((r) => r.isRequired))
const allApproved = computed(
  () => required.value.length > 0 && required.value.every((r) => r.status === 'approved')
)
const hasRejected = computed(() => reviewers.value.some((r) => r.status === 'rejected'))
const hasChanges = computed(() => reviewers.value.some((r) => r.status === 'changes_required'))

const summary = computed(() => {
  if (hasRejected.value) return 'A reviewer rejected'
  if (hasChanges.value) return 'Changes requested'
  if (allApproved.value) return 'All reviewers aligned'
  const approved = reviewers.value.filter((r) => r.status === 'approved').length
  return `${approved} of ${required.value.length} approved`
})

const summaryColor = computed<'neutral' | 'info' | 'success' | 'warning' | 'error'>(() => {
  if (hasRejected.value) return 'error'
  if (hasChanges.value) return 'warning'
  if (allApproved.value) return 'success'
  return 'info'
})

function reviewerName(r: (typeof reviewers.value)[number]): string {
  return [r.userFirstName, r.userLastName].filter(Boolean).join(' ') || r.userEmail
}
</script>

<template>
  <UCard v-if="reviewers.length">
    <template #header>
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold text-default">Reviewer alignment</h3>
        <UBadge :color="summaryColor" variant="subtle" size="sm" :label="summary" />
      </div>
    </template>

    <div class="space-y-3">
      <div
        v-for="r in reviewers"
        :key="r.id"
        class="rounded-lg border border-default bg-default/30 p-3"
      >
        <div class="flex items-center justify-between gap-2">
          <div>
            <p class="text-sm font-medium text-default">{{ reviewerName(r) }}</p>
            <p class="text-xs text-muted">{{ PROPOSAL_ASSIGNMENT_ROLE_LABEL[r.reviewerRole] }}</p>
          </div>
          <UBadge
            :color="PROPOSAL_REVIEWER_STATUS_COLOR[r.status]"
            variant="subtle"
            size="sm"
            :label="PROPOSAL_REVIEWER_STATUS_LABEL[r.status]"
          />
        </div>
        <p
          v-if="r.feedback"
          class="mt-2 whitespace-pre-wrap border-l-2 border-default pl-3 text-xs text-muted"
        >
          {{ r.feedback }}
        </p>
      </div>
    </div>
  </UCard>
</template>
