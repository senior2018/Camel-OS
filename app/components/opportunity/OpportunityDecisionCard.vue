<script setup lang="ts">
import { OPPORTUNITY_DECISION_STATUS_LABEL, OPPORTUNITY_DECISION_STATUS_DESCRIPTION } from '@@/shared/schemas/opportunity-decision'
import type { CreateOpportunityDecisionPayload } from '@@/shared/schemas/opportunity-decision'

interface Props {
  opportunityId: string
  canDecide?: boolean
}

withDefaults(defineProps<Props>(), {
  canDecide: false,
})

const emit = defineEmits<{
  decided: [status: string]
}>()

const { decision, makeDecision } = useOpportunityDecision(computed(() => props.opportunityId))
const props = defineProps<Props>()

const decisionReason = ref('')
const submitting = ref(false)
const showRejectForm = ref(false)

async function approve() {
  submitting.value = true
  const ok = await makeDecision({
    status: 'approved',
    decisionReason: 'Approved for proposal development',
  })
  if (ok) {
    emit('decided', 'approved')
  }
  submitting.value = false
}

async function reject() {
  if (!decisionReason.value.trim()) {
    useToast().add({
      title: 'Reason required',
      description: 'Please provide a reason for rejection',
      color: 'warning',
    })
    return
  }

  submitting.value = true
  const ok = await makeDecision({
    status: 'rejected',
    decisionReason: decisionReason.value,
  })
  if (ok) {
    emit('decided', 'rejected')
  }
  submitting.value = false
}
</script>

<template>
  <div v-if="canDecide || decision">
    <!-- Pending Decision -->
    <UCard v-if="!decision || decision.status === 'pending'">
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-default">Go / No-Go Decision</h3>
          <UBadge variant="subtle" color="gray">Pending</UBadge>
        </div>
      </template>

      <div v-if="canDecide" class="space-y-4">
        <p class="text-sm text-muted">
          Should we proceed with proposal development for this opportunity?
        </p>

        <!-- Approve Option -->
        <div
          class="rounded-lg border border-success/20 bg-success/5 p-4 transition-all hover:border-success/40"
        >
          <div class="mb-3 flex items-center gap-2">
            <UIcon name="i-lucide-check-circle" class="size-5 text-success" />
            <h4 class="font-medium text-default">Approved</h4>
          </div>
          <p class="mb-3 text-sm text-muted">Proceed with proposal development</p>
          <UButton
            :loading="submitting"
            size="sm"
            color="success"
            variant="soft"
            label="Approve"
            @click="approve"
          />
        </div>

        <!-- Reject Option -->
        <div
          class="rounded-lg border border-error/20 bg-error/5 p-4 transition-all hover:border-error/40"
        >
          <div class="mb-3 flex items-center gap-2">
            <UIcon name="i-lucide-x-circle" class="size-5 text-error" />
            <h4 class="font-medium text-default">Not Pursuing</h4>
          </div>
          <p class="mb-3 text-sm text-muted">Decision not to pursue this opportunity</p>

          <div v-if="!showRejectForm" class="flex gap-2">
            <UButton
              size="sm"
              color="error"
              variant="soft"
              label="Not Pursuing"
              @click="showRejectForm = true"
            />
          </div>

          <div v-else class="space-y-2">
            <UTextarea
              v-model="decisionReason"
              placeholder="Why are we not pursuing this opportunity?"
              size="sm"
            />
            <div class="flex gap-2">
              <UButton
                :loading="submitting"
                size="sm"
                color="error"
                label="Confirm Rejection"
                @click="reject"
              />
              <UButton
                variant="ghost"
                size="sm"
                label="Cancel"
                @click="showRejectForm = false"
              />
            </div>
          </div>
        </div>
      </div>

      <div v-else class="text-center text-sm text-muted">
        <p>Waiting for decision...</p>
      </div>
    </UCard>

    <!-- Decision Made -->
    <UCard v-else>
      <template #header>
        <div class="flex items-center justify-between">
          <h3 class="font-semibold text-default">Go / No-Go Decision</h3>
          <UBadge
            :color="decision.status === 'approved' ? 'success' : 'error'"
            variant="subtle"
          >
            {{ OPPORTUNITY_DECISION_STATUS_LABEL[decision.status] }}
          </UBadge>
        </div>
      </template>

      <div class="space-y-3">
        <p class="text-sm text-muted">
          {{ OPPORTUNITY_DECISION_STATUS_DESCRIPTION[decision.status] }}
        </p>

        <div v-if="decision.decisionReason" class="rounded-lg border border-default bg-default/30 p-3">
          <p class="text-xs font-medium text-muted">Decision Reason</p>
          <p class="mt-1 text-sm text-default">{{ decision.decisionReason }}</p>
        </div>

        <div v-if="decision.decidedAt" class="text-xs text-muted">
          Decision made
          {{ new Date(decision.decidedAt).toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }) }}
        </div>
      </div>
    </UCard>
  </div>
</template>
