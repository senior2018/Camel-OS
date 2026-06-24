<script setup lang="ts">
import {
  PROPOSAL_REVIEWER_STATUS_COLOR,
  PROPOSAL_REVIEWER_STATUS_LABEL,
} from '@@/shared/schemas/proposal-review'

/**
 * Compact reviewer action (redesign v2, P3.2). Replaces the old "Your review"
 * and "Reviewer alignment" cards: a single button → popup with the three
 * decisions + an optional message that posts into the conversation (reason
 * required on reject). Alignment is now read from the conversation's
 * "Decisions only" filter. Renders nothing unless the viewer is an assigned
 * reviewer on this proposal.
 */
const props = defineProps<{ proposalId: string }>()
const emit = defineEmits<{ changed: [] }>()

const toast = useToast()
const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)

const { reviewers, submitReview } = useProposalReview(computed(() => props.proposalId))
const myReview = computed(() =>
  reviewers.value.find((r) => r.reviewerUserId === currentUserId.value)
)
const decided = computed(() => !!myReview.value && myReview.value.status !== 'pending')

type Decision = 'approved' | 'changes_required' | 'rejected'
interface DecisionOption {
  value: Decision
  label: string
  hint: string
  icon: string
  iconClass: string
  activeClass: string
}
// Static classes only — Tailwind can't see interpolated class names.
const options: DecisionOption[] = [
  {
    value: 'approved',
    label: 'Approve',
    hint: 'Ready to proceed',
    icon: 'i-lucide-check',
    iconClass: 'text-success',
    activeClass: 'border-success bg-success/5',
  },
  {
    value: 'changes_required',
    label: 'Request changes',
    hint: 'Send back for revision',
    icon: 'i-lucide-rotate-ccw',
    iconClass: 'text-warning',
    activeClass: 'border-warning bg-warning/5',
  },
  {
    value: 'rejected',
    label: 'Reject',
    hint: 'Should not proceed — reason required',
    icon: 'i-lucide-x',
    iconClass: 'text-error',
    activeClass: 'border-error bg-error/5',
  },
]

const open = ref(false)
const decision = ref<Decision | null>(null)
const message = ref('')
const saving = ref(false)
const needsReason = computed(() => decision.value === 'rejected')

function start() {
  decision.value = null
  message.value = ''
  open.value = true
}

async function submit() {
  if (!decision.value) {
    toast.add({ title: 'Pick a decision', color: 'warning' })
    return
  }
  if (needsReason.value && !message.value.trim()) {
    toast.add({ title: 'A reason is required to reject', color: 'warning' })
    return
  }
  saving.value = true
  const ok = await submitReview({
    status: decision.value,
    feedback: message.value.trim() || undefined,
  })
  saving.value = false
  if (ok) {
    open.value = false
    emit('changed')
  }
}
</script>

<template>
  <div v-if="myReview">
    <!-- Already decided — compact, alignment lives in the conversation -->
    <div
      v-if="decided"
      class="flex items-center justify-between rounded-lg border border-default bg-elevated/30 px-3 py-2"
    >
      <span class="text-sm text-muted">Your review</span>
      <div class="flex items-center gap-2">
        <UBadge
          :color="PROPOSAL_REVIEWER_STATUS_COLOR[myReview.status]"
          variant="subtle"
          size="sm"
          :label="PROPOSAL_REVIEWER_STATUS_LABEL[myReview.status]"
        />
        <UButton size="xs" variant="ghost" color="neutral" label="Change" @click="start" />
      </div>
    </div>

    <!-- Pending -->
    <div
      v-else
      class="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-primary/30 bg-primary/5 px-3 py-2"
    >
      <p class="text-sm text-default">
        <UIcon name="i-lucide-clipboard-check" class="mr-1 inline size-4 text-primary" />
        You're a reviewer on this proposal.
      </p>
      <UButton size="sm" icon="i-lucide-gavel" label="Submit review" @click="start" />
    </div>

    <!-- Decision popup -->
    <UModal v-model:open="open" title="Submit your review">
      <template #body>
        <div class="space-y-4">
          <div class="grid gap-2">
            <button
              v-for="opt in options"
              :key="opt.value"
              type="button"
              class="flex items-start gap-3 rounded-lg border-2 p-3 text-left transition-all"
              :class="
                decision === opt.value ? opt.activeClass : 'border-default hover:border-default/80'
              "
              @click="decision = opt.value"
            >
              <UIcon :name="opt.icon" class="mt-0.5 size-4" :class="opt.iconClass" />
              <span>
                <span class="block text-sm font-medium text-default">{{ opt.label }}</span>
                <span class="block text-xs text-muted">{{ opt.hint }}</span>
              </span>
            </button>
          </div>

          <UFormField :label="needsReason ? 'Reason (required)' : 'Message (optional)'">
            <UTextarea
              v-model="message"
              :rows="3"
              placeholder="This posts into the proposal conversation…"
              class="w-full"
            />
          </UFormField>
        </div>
      </template>
      <template #footer>
        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" label="Cancel" @click="open = false" />
          <UButton
            :loading="saving"
            label="Submit review"
            :disabled="!decision || (needsReason && !message.trim())"
            @click="submit"
          />
        </div>
      </template>
    </UModal>
  </div>
</template>
