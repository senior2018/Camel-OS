<script setup lang="ts">
import {
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_DESCRIPTION,
  PROPOSAL_STATUS_LABEL,
  type ProposalStatus,
  type UpdateProposalPayload,
} from '@@/shared/schemas/proposal'

definePageMeta({
  layout: 'dashboard',
})

const route = useRoute()
const proposalId = computed(() => route.params.id as string)
const toast = useToast()

const { can } = await usePermissions()
if (!can.value('proposal', 'read')) {
  throw createError({
    statusCode: 403,
    statusMessage: 'You do not have permission to view proposals.',
    fatal: true,
  })
}
const canEdit = computed(() => can.value('proposal', 'update'))

const { user } = useUserSession()
const currentUserId = computed(() => (user.value as { id: string } | null)?.id ?? null)

interface ProposalDetail {
  id: string
  opportunityId: string
  title: string
  status: ProposalStatus
  deadline: string | null
  contentDraft: string | null
  submittedAt: string | null
  decidedAt: string | null
  decisionNote: string | null
  reminderRecipientUserIds: string[]
  createdAt: string
  updatedAt: string
  opportunityTitle: string
  opportunityStatus: string
  opportunityDescription: string | null
  opportunityValue: string | null
  opportunityCurrency: string
  opportunityDeadline: string | null
  opportunityWinProbability: number | null
  opportunityTags: string[]
  createdByFirstName: string | null
  createdByLastName: string | null
}

const { data, refresh, status } = await useFetch<{ proposal: ProposalDetail }>(
  () => `/api/proposals/${proposalId.value}`,
  { key: () => `proposal-${proposalId.value}` }
)

useHead({
  title: computed(() => `${data.value?.proposal.title ?? 'Proposal'} — Camel OS`),
})

const { assignments, markReadyForReview, refreshReviewers, refreshAssignments } =
  useProposalReview(proposalId)

interface TeamMember {
  id: string
  email: string
  firstName: string
  lastName: string
}
const { data: teamData } = await useFetch<{ members: TeamMember[] }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})

const recipientOptions = computed(() =>
  (teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id,
  }))
)

// ─── Role gating ──────────────────────────────────────────────────────────────
const proposalStatus = computed<ProposalStatus>(() => data.value?.proposal.status ?? 'assigned')

const isLead = computed(() =>
  assignments.value.some((a) => a.roleType === 'lead' && a.assignedUserId === currentUserId.value)
)
const isFinalApprover = computed(() =>
  assignments.value.some(
    (a) => a.roleType === 'final_approver' && a.assignedUserId === currentUserId.value
  )
)
const hasReviewerRoles = computed(() =>
  assignments.value.some((a) =>
    ['technical_reviewer', 'finance_reviewer', 'compliance_reviewer'].includes(a.roleType)
  )
)
// Lead-or-manager may drive the workflow buttons.
const canDrive = computed(() => canEdit.value || isLead.value)

const canSendForReview = computed(
  () =>
    canDrive.value &&
    hasReviewerRoles.value &&
    (proposalStatus.value === 'drafting' || proposalStatus.value === 'revision_required')
)
const showFinalApproval = computed(
  () =>
    isFinalApprover.value &&
    (proposalStatus.value === 'ready_for_final_approval' ||
      proposalStatus.value === 'awaiting_final_approval')
)
const showSubmit = computed(() => canDrive.value && proposalStatus.value === 'final_approved')
const showOutcome = computed(() => canDrive.value && proposalStatus.value === 'submitted')
const isClosed = computed(
  () => proposalStatus.value === 'rejected' || proposalStatus.value === 'final_rejected'
)

// ─── Edit form (draft / details / recipients) ──────────────────────────────────
const editing = ref(false)
const form = reactive<{
  title: string
  deadline: string
  contentDraft: string
  decisionNote: string
  reminderRecipientUserIds: string[]
}>({
  title: '',
  deadline: '',
  contentDraft: '',
  decisionNote: '',
  reminderRecipientUserIds: [],
})

function syncForm() {
  if (!data.value) return
  const p = data.value.proposal
  form.title = p.title
  form.deadline = p.deadline ?? ''
  form.contentDraft = p.contentDraft ?? ''
  form.decisionNote = p.decisionNote ?? ''
  form.reminderRecipientUserIds = [...(p.reminderRecipientUserIds ?? [])]
}
watch(data, syncForm, { immediate: true })

const saving = ref(false)
async function save() {
  saving.value = true
  try {
    const payload: UpdateProposalPayload = {
      title: form.title,
      deadline: form.deadline || null,
      contentDraft: form.contentDraft || null,
      decisionNote: form.decisionNote || null,
      reminderRecipientUserIds: form.reminderRecipientUserIds,
    }
    await $fetch(`/api/proposals/${proposalId.value}`, { method: 'PATCH', body: payload })
    toast.add({ title: 'Proposal saved', color: 'success' })
    editing.value = false
    await refresh()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.'
    toast.add({ title: 'Save failed', description: msg, color: 'error' })
  } finally {
    saving.value = false
  }
}

// ─── Workflow actions ──────────────────────────────────────────────────────────
async function onAfterChange() {
  await Promise.all([refresh(), refreshReviewers(), refreshAssignments()])
}

const sendingForReview = ref(false)
async function sendForReview() {
  sendingForReview.value = true
  const ok = await markReadyForReview()
  sendingForReview.value = false
  if (ok) await onAfterChange()
}

const finalNote = ref('')
const finalActing = ref(false)
async function finalDecision(decision: 'approved' | 'rejected') {
  finalActing.value = true
  try {
    await $fetch(`/api/proposals/${proposalId.value}/final-approval`, {
      method: 'POST',
      body: { decision, note: finalNote.value || null },
    })
    toast.add({
      title: decision === 'approved' ? 'Approved to submit' : 'Final rejection recorded',
      color: decision === 'approved' ? 'success' : 'error',
    })
    finalNote.value = ''
    await onAfterChange()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.'
    toast.add({ title: 'Could not record decision', description: msg, color: 'error' })
  } finally {
    finalActing.value = false
  }
}

const settingStatus = ref(false)
async function setStatus(s: ProposalStatus) {
  settingStatus.value = true
  try {
    await $fetch(`/api/proposals/${proposalId.value}`, { method: 'PATCH', body: { status: s } })
    toast.add({ title: `Marked ${PROPOSAL_STATUS_LABEL[s]}`, color: 'success' })
    await onAfterChange()
  } catch (err: unknown) {
    const msg =
      (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Please try again.'
    toast.add({ title: 'Could not update', description: msg, color: 'error' })
  } finally {
    settingStatus.value = false
  }
}

function formatMoney(v: string | null, currency = 'USD'): string {
  if (!v) return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return `${v} ${currency}`
  return `${n.toLocaleString(undefined, { maximumFractionDigits: 0 })} ${currency}`
}

const recipientChips = computed(() =>
  form.reminderRecipientUserIds
    .map((id) => recipientOptions.value.find((o) => o.value === id)?.label)
    .filter(Boolean)
)
</script>

<template>
  <div class="space-y-6">
    <div v-if="status === 'pending'" class="flex justify-center py-16">
      <UIcon name="i-lucide-loader-circle" class="size-8 animate-spin text-muted" />
    </div>

    <div v-else-if="!data" class="rounded-xl border border-dashed border-default p-12 text-center">
      <p class="text-sm text-muted">Proposal not found.</p>
      <UButton
        variant="ghost"
        label="Back to proposals"
        class="mt-3"
        @click="navigateTo('/proposals')"
      />
    </div>

    <template v-else>
      <header class="space-y-3">
        <UButton
          variant="ghost"
          color="neutral"
          icon="i-lucide-arrow-left"
          label="All proposals"
          size="xs"
          @click="navigateTo('/proposals')"
        />
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div class="flex flex-wrap items-center gap-3">
              <h1 class="text-2xl font-semibold tracking-tight text-default">
                {{ data.proposal.title }}
              </h1>
              <UBadge
                :color="PROPOSAL_STATUS_COLOR[data.proposal.status]"
                variant="subtle"
                size="sm"
                :label="PROPOSAL_STATUS_LABEL[data.proposal.status]"
              />
            </div>
            <p class="mt-1 text-sm text-muted">
              <UIcon name="i-lucide-target" class="mr-1 inline size-3.5" />
              {{ data.proposal.opportunityTitle }} ·
              {{ PROPOSAL_STATUS_DESCRIPTION[data.proposal.status] }}
            </p>
          </div>
          <UButton
            v-if="canEdit && !editing"
            variant="outline"
            icon="i-lucide-pencil"
            label="Edit"
            size="sm"
            @click="editing = true"
          />
        </div>
      </header>

      <!-- Workflow action bar — contextual to the current stage -->
      <UCard v-if="canSendForReview || showFinalApproval || showSubmit || showOutcome || isClosed">
        <div class="space-y-3">
          <p class="text-xs font-medium uppercase tracking-wide text-muted">Next step</p>

          <!-- Lead: send for review -->
          <div v-if="canSendForReview" class="flex flex-wrap items-center gap-3">
            <p class="text-sm text-default">
              Drafting done? Send to the assigned reviewers for their decision.
            </p>
            <UButton
              :loading="sendingForReview"
              icon="i-lucide-send"
              label="Send for review"
              @click="sendForReview"
            />
          </div>

          <!-- Final approver -->
          <div v-if="showFinalApproval" class="space-y-2">
            <p class="text-sm text-default">
              All reviewers have aligned. Record your final decision.
            </p>
            <UTextarea
              v-model="finalNote"
              :rows="3"
              placeholder="Optional note for the team…"
              class="w-full"
            />
            <div class="flex gap-2">
              <UButton
                :loading="finalActing"
                color="success"
                icon="i-lucide-shield-check"
                label="Approve to submit"
                @click="finalDecision('approved')"
              />
              <UButton
                :loading="finalActing"
                color="error"
                variant="soft"
                icon="i-lucide-x"
                label="Reject"
                @click="finalDecision('rejected')"
              />
            </div>
          </div>

          <!-- Submit to client -->
          <div v-if="showSubmit" class="flex flex-wrap items-center gap-3">
            <p class="text-sm text-default">Cleared for submission.</p>
            <UButton
              :loading="settingStatus"
              icon="i-lucide-upload"
              label="Mark submitted"
              @click="setStatus('submitted')"
            />
          </div>

          <!-- Outcome -->
          <div v-if="showOutcome" class="flex flex-wrap items-center gap-2">
            <p class="mr-1 text-sm text-default">Record the outcome:</p>
            <UButton
              :loading="settingStatus"
              color="success"
              size="sm"
              label="Won"
              @click="setStatus('won')"
            />
            <UButton
              :loading="settingStatus"
              color="error"
              variant="soft"
              size="sm"
              label="Lost"
              @click="setStatus('lost')"
            />
            <UButton
              :loading="settingStatus"
              color="warning"
              variant="soft"
              size="sm"
              label="Shortlisted"
              @click="setStatus('shortlisted')"
            />
          </div>

          <!-- Closed -->
          <div v-if="isClosed" class="flex flex-wrap items-center gap-3">
            <p class="text-sm text-error">This proposal was stopped.</p>
            <UButton
              v-if="canDrive"
              variant="outline"
              size="sm"
              icon="i-lucide-rotate-ccw"
              label="Reopen for drafting"
              @click="setStatus('drafting')"
            />
          </div>
        </div>
      </UCard>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Main column -->
        <div class="space-y-6 lg:col-span-2">
          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-default">Draft</h3>
            </template>
            <UTextarea
              v-if="editing"
              v-model="form.contentDraft"
              :rows="14"
              placeholder="Capture the proposal's key sections — executive summary, methodology, team, budget…"
              class="w-full"
            />
            <p
              v-else-if="data.proposal.contentDraft"
              class="whitespace-pre-wrap text-sm text-default"
            >
              {{ data.proposal.contentDraft }}
            </p>
            <p v-else class="text-sm text-muted">
              No draft yet. Click <b>Edit</b> to start writing.
            </p>
          </UCard>

          <!-- Reviewer alignment + the current user's review form -->
          <ProposalReviewerStatusCard :proposal-id="proposalId" />
          <ProposalReviewForm
            :proposal-id="proposalId"
            :proposal-title="data.proposal.title"
            @changed="onAfterChange"
          />

          <UCard
            v-if="
              data.proposal.status === 'won' ||
              data.proposal.status === 'lost' ||
              data.proposal.status === 'final_rejected' ||
              editing
            "
          >
            <template #header>
              <h3 class="text-sm font-semibold text-default">Decision note</h3>
            </template>
            <UTextarea
              v-if="editing"
              v-model="form.decisionNote"
              :rows="4"
              placeholder="Capture context about the win/loss decision."
              class="w-full"
            />
            <p
              v-else-if="data.proposal.decisionNote"
              class="whitespace-pre-wrap text-sm text-default"
            >
              {{ data.proposal.decisionNote }}
            </p>
            <p v-else class="text-sm text-muted">No decision note yet.</p>
          </UCard>

          <div v-if="editing" class="flex justify-end gap-2">
            <UButton variant="ghost" label="Cancel" @click="((editing = false), syncForm())" />
            <UButton :loading="saving" label="Save changes" @click="save" />
          </div>

          <OpportunityActivityTimeline :opportunity-id="data.proposal.opportunityId" />
        </div>

        <!-- Sidebar -->
        <div class="space-y-6 lg:col-span-1">
          <ProposalTeamAssignmentCard
            :proposal-id="proposalId"
            :can-assign="canEdit"
            @changed="onAfterChange"
          />

          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-default">Proposal details</h3>
            </template>
            <div class="space-y-3 text-sm">
              <div v-if="editing">
                <UFormField label="Title">
                  <UInput v-model="form.title" class="w-full" />
                </UFormField>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">Deadline</p>
                <UInput
                  v-if="editing"
                  v-model="form.deadline"
                  type="date"
                  size="sm"
                  class="mt-1 w-full"
                />
                <p v-else class="text-default">{{ data.proposal.deadline ?? '—' }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">Submitted at</p>
                <p class="text-default">{{ data.proposal.submittedAt ?? '—' }}</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">Decided at</p>
                <p class="text-default">{{ data.proposal.decidedAt ?? '—' }}</p>
              </div>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-default">Reminder recipients</h3>
            </template>
            <USelectMenu
              v-if="editing"
              v-model="form.reminderRecipientUserIds"
              :items="recipientOptions"
              value-key="value"
              multiple
              placeholder="Pick teammates…"
              class="w-full"
            />
            <div v-else class="flex flex-wrap gap-1">
              <UBadge
                v-for="(label, i) in recipientChips"
                :key="i"
                variant="subtle"
                color="primary"
                size="xs"
                :label="String(label)"
              />
              <span v-if="!recipientChips.length" class="text-sm text-muted">None yet.</span>
            </div>
          </UCard>

          <UCard>
            <template #header>
              <h3 class="text-sm font-semibold text-default">Opportunity context</h3>
            </template>
            <div class="space-y-3 text-sm">
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">Estimated value</p>
                <p class="text-default">
                  {{
                    formatMoney(data.proposal.opportunityValue, data.proposal.opportunityCurrency)
                  }}
                </p>
              </div>
              <div v-if="data.proposal.opportunityWinProbability !== null">
                <p class="text-xs uppercase tracking-wide text-muted">Win probability</p>
                <p class="text-default">{{ data.proposal.opportunityWinProbability }}%</p>
              </div>
              <div>
                <p class="text-xs uppercase tracking-wide text-muted">Opportunity deadline</p>
                <p class="text-default">{{ data.proposal.opportunityDeadline ?? '—' }}</p>
              </div>
              <div v-if="data.proposal.opportunityTags?.length">
                <p class="text-xs uppercase tracking-wide text-muted">Tags</p>
                <div class="mt-1 flex flex-wrap gap-1">
                  <UBadge
                    v-for="t in data.proposal.opportunityTags"
                    :key="t"
                    variant="soft"
                    color="neutral"
                    size="xs"
                    :label="`#${t}`"
                  />
                </div>
              </div>
              <div v-if="data.proposal.opportunityDescription">
                <p class="text-xs uppercase tracking-wide text-muted">Description</p>
                <p class="whitespace-pre-wrap text-default">
                  {{ data.proposal.opportunityDescription }}
                </p>
              </div>
            </div>
          </UCard>
        </div>
      </div>
    </template>
  </div>
</template>
