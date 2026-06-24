<script setup lang="ts">
import {
  PROPOSAL_STATUS_COLOR,
  PROPOSAL_STATUS_DESCRIPTION,
  PROPOSAL_STATUS_LABEL,
  type ProposalStatus,
  type UpdateProposalPayload,
} from '@@/shared/schemas/proposal'
import type { ProposalRoleDef } from '@@/shared/schemas/proposal-settings'

definePageMeta({
  layout: 'dashboard',
})

const route = useRoute()
const proposalId = computed(() => route.params.id as string)
const toast = useToast()

const { can, isSystemAdmin } = await usePermissions()
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
  reviewMinReviewers: number
  reviewRule: 'all' | 'count' | 'percent'
  reviewThreshold: number | null
  requireFinalApprover: boolean
  rolesOverride: ProposalRoleDef[] | null
  outcomeStagesOverride: string[] | null
  evaluationStage: string | null
  deadline: string | null
  contentDraft: string | null
  brainstorm: string | null
  writingMode: 'in_system' | 'upload' | 'both'
  submissionReference: string | null
  submissionChannel: string | null
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

interface ResolvedSettings {
  roles: ProposalRoleDef[]
  outcomeStages: string[]
  reviewMinReviewers: number
  reviewRule: 'all' | 'count' | 'percent'
  reviewThreshold: number | null
  requireFinalApprover: boolean
}

const { data, refresh, status } = await useFetch<{
  proposal: ProposalDetail
  settings: ResolvedSettings
}>(() => `/api/proposals/${proposalId.value}`, { key: () => `proposal-${proposalId.value}` })

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
    ['reviewer', 'technical_reviewer', 'finance_reviewer', 'compliance_reviewer'].includes(
      a.roleType
    )
  )
)
const isContributor = computed(() =>
  assignments.value.some(
    (a) => a.roleType === 'contributor' && a.assignedUserId === currentUserId.value
  )
)
// Content-editing mirrors the server's `isProposalWriter`: the Lead, an Editor
// (contributor), or a true system admin. Module oversight (`proposal:admin`,
// e.g. a Manager) deliberately does NOT grant editing — only visibility.
const canWrite = computed(() => isSystemAdmin.value || isLead.value || isContributor.value)
// Lead-or-manager may drive the workflow buttons.
const canDrive = computed(() => canEdit.value || isLead.value)
// Review policy + Manage Access are the Lead's or a manager's (proposal:admin).
const canManagePolicy = computed(
  () => isSystemAdmin.value || isLead.value || can.value('proposal', 'admin')
)
const canManageAccess = canManagePolicy

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
// BD-01 — post-submission evaluation tracking (BD officer / manager).
const showBdTracking = computed(
  () =>
    canDrive.value &&
    ['submitted', 'under_evaluation', 'clarification_requested', 'shortlisted', 'won'].includes(
      proposalStatus.value
    )
)
const isClosed = computed(
  () => proposalStatus.value === 'rejected' || proposalStatus.value === 'final_rejected'
)
// P3.3c — a manager may override a decided outcome (e.g. correct Lost → Won).
const isDecided = computed(() => ['won', 'lost', 'contract_signed'].includes(proposalStatus.value))
const canOverride = computed(() => isSystemAdmin.value || can.value('proposal', 'admin'))
// BD-02 — the post-submission log appears once a proposal has been submitted.
const isPostSubmission = computed(() =>
  [
    'submitted',
    'under_evaluation',
    'clarification_requested',
    'shortlisted',
    'won',
    'lost',
    'contract_signed',
  ].includes(proposalStatus.value)
)

// ─── Edit form (draft / details / recipients) ──────────────────────────────────
const editing = ref(false)
const form = reactive<{
  title: string
  deadline: string
  contentDraft: string
  decisionNote: string
  submissionReference: string
  submissionChannel: string
  reminderRecipientUserIds: string[]
}>({
  title: '',
  deadline: '',
  contentDraft: '',
  decisionNote: '',
  submissionReference: '',
  submissionChannel: '',
  reminderRecipientUserIds: [],
})

function syncForm() {
  if (!data.value) return
  const p = data.value.proposal
  form.title = p.title
  form.deadline = p.deadline ?? ''
  form.contentDraft = p.contentDraft ?? ''
  form.decisionNote = p.decisionNote ?? ''
  form.submissionReference = p.submissionReference ?? ''
  form.submissionChannel = p.submissionChannel ?? ''
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
      submissionReference: form.submissionReference || null,
      submissionChannel: form.submissionChannel || null,
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

// Working surface tabs (left). The Conversation lives in a persistent right
// rail — always visible, since not everyone scrolls. Documents sit under the
// editor in the Document tab; reviewers act from a popup by the document.
const workspaceTabs = [
  { label: 'Document', icon: 'i-lucide-file-text', slot: 'document' as const },
  { label: 'Team', icon: 'i-lucide-users', slot: 'team' as const },
  { label: 'Activity', icon: 'i-lucide-history', slot: 'activity' as const },
  { label: 'Details', icon: 'i-lucide-info', slot: 'details' as const },
]
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
          <div class="flex items-center gap-2">
            <UButton
              variant="outline"
              color="neutral"
              icon="i-lucide-file-down"
              label="Export PDF"
              size="sm"
              @click="navigateTo(`/print/proposal/${proposalId}`, { open: { target: '_blank' } })"
            />
            <UButton
              v-if="canEdit && !editing"
              variant="outline"
              icon="i-lucide-pencil"
              label="Edit"
              size="sm"
              @click="editing = true"
            />
          </div>
        </div>
      </header>

      <div class="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <!-- Working surface — tabbed -->
        <div class="lg:col-span-2">
          <UTabs
            :items="workspaceTabs"
            :unmount-on-hide="false"
            variant="link"
            class="w-full gap-4"
          >
            <!-- Document — one rich editor that fills the column; the Next-step
                 workflow bar sits below it. Documents live in the right rail. -->
            <template #document>
              <!-- Height trimmed by the tab bar above it so this column's bottom
                   lines up with the right rail's. -->
              <div class="flex flex-col gap-3 lg:h-[calc(100dvh-10.5rem)]">
                <!-- Reviewers act right by the document (popup → conversation) -->
                <ProposalReviewAction :proposal-id="proposalId" @changed="onAfterChange" />

                <p class="text-sm text-muted">
                  <span v-if="canWrite">Compose the proposal — changes autosave.</span>
                  <span v-else>Read-only — only the writing team can edit this document.</span>
                </p>
                <ClientOnly>
                  <ProposalEditor
                    :proposal-id="proposalId"
                    :content="data.proposal.contentDraft"
                    :editable="canWrite"
                    class="min-h-0 flex-1"
                  />
                  <template #fallback>
                    <div
                      class="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-default text-sm text-muted"
                    >
                      Loading editor…
                    </div>
                  </template>
                </ClientOnly>

                <!-- Next step — workflow actions, below the composer -->
                <UCard
                  v-if="
                    canSendForReview ||
                    showFinalApproval ||
                    showSubmit ||
                    showBdTracking ||
                    isClosed ||
                    (isDecided && canOverride)
                  "
                  :ui="{ body: 'p-3' }"
                >
                  <div class="space-y-3">
                    <p class="text-xs font-medium uppercase tracking-wide text-muted">Next step</p>

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

                    <ProposalFinalApprovalCard
                      v-if="showFinalApproval"
                      :proposal-id="proposalId"
                      @changed="onAfterChange"
                    />

                    <div v-if="showSubmit" class="flex flex-wrap items-center gap-3">
                      <p class="text-sm text-default">Cleared for submission.</p>
                      <UButton
                        :loading="settingStatus"
                        icon="i-lucide-upload"
                        label="Mark submitted"
                        @click="setStatus('submitted')"
                      />
                    </div>

                    <ProposalOutcomeCard
                      v-if="showBdTracking || (isDecided && canOverride)"
                      :proposal-id="proposalId"
                      :status="proposalStatus"
                      :evaluation-stage="data.proposal.evaluationStage"
                      :can-override="isDecided && canOverride"
                      :stages="data.settings?.outcomeStages ?? []"
                      @changed="onAfterChange"
                    />

                    <div
                      v-if="proposalStatus === 'contract_signed'"
                      class="flex items-center gap-2"
                    >
                      <UIcon name="i-lucide-circle-check" class="size-4 text-success" />
                      <p class="text-sm text-success">Contract signed — a project was created.</p>
                    </div>

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
              </div>
            </template>

            <!-- Team -->
            <template #team>
              <div class="space-y-6">
                <ProposalManageAccessCard
                  :proposal-id="proposalId"
                  :roles="data.settings?.roles ?? []"
                  :min-reviewers="data.proposal.reviewMinReviewers"
                  :can-manage="canManageAccess"
                  @changed="onAfterChange"
                />
                <ProposalReviewPolicyCard
                  :proposal-id="proposalId"
                  :min-reviewers="data.proposal.reviewMinReviewers"
                  :rule="data.proposal.reviewRule"
                  :threshold="data.proposal.reviewThreshold"
                  :require-final-approver="data.proposal.requireFinalApprover"
                  :can-manage="canManagePolicy"
                  @changed="refresh"
                />
                <ProposalSettingsOverrideCard
                  :proposal-id="proposalId"
                  :effective-roles="data.settings?.roles ?? []"
                  :effective-stages="data.settings?.outcomeStages ?? []"
                  :roles-overridden="!!data.proposal.rolesOverride"
                  :stages-overridden="!!data.proposal.outcomeStagesOverride"
                  :can-manage="canManageAccess"
                  @changed="refresh"
                />
              </div>
            </template>

            <!-- Activity — timeline + post-submission tracking log -->
            <template #activity>
              <div class="space-y-6">
                <ProposalBdLogCard
                  v-if="isPostSubmission"
                  :proposal-id="proposalId"
                  :can-log="canDrive"
                />
                <OpportunityActivityTimeline :opportunity-id="data.proposal.opportunityId" />
              </div>
            </template>

            <!-- Details — context + editable fields -->
            <template #details>
              <div class="space-y-6">
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
                      <p class="text-xs uppercase tracking-wide text-muted">Submission reference</p>
                      <UInput
                        v-if="editing"
                        v-model="form.submissionReference"
                        size="sm"
                        placeholder="Portal ref / tender no."
                        class="mt-1 w-full"
                      />
                      <p v-else class="text-default">
                        {{ data.proposal.submissionReference ?? '—' }}
                      </p>
                    </div>
                    <div>
                      <p class="text-xs uppercase tracking-wide text-muted">Submission channel</p>
                      <UInput
                        v-if="editing"
                        v-model="form.submissionChannel"
                        size="sm"
                        placeholder="Email / portal / physical"
                        class="mt-1 w-full"
                      />
                      <p v-else class="text-default">
                        {{ data.proposal.submissionChannel ?? '—' }}
                      </p>
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
                          formatMoney(
                            data.proposal.opportunityValue,
                            data.proposal.opportunityCurrency
                          )
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

                <div v-if="editing" class="flex justify-end gap-2">
                  <UButton
                    variant="ghost"
                    label="Cancel"
                    @click="((editing = false), syncForm())"
                  />
                  <UButton :loading="saving" label="Save changes" @click="save" />
                </div>
              </div>
            </template>
          </UTabs>
        </div>

        <!-- Right rail — Conversation + Documents, half-half, each scrolls
             internally, persistent while the editor owns the main column. -->
        <div
          class="flex flex-col gap-6 lg:sticky lg:top-6 lg:col-span-1 lg:h-[calc(100dvh-7rem)] lg:self-start"
        >
          <ProposalConversationCard
            :proposal-id="proposalId"
            class="flex min-h-0 flex-1 flex-col"
          />
          <ProposalDocumentsCard
            :proposal-id="proposalId"
            :can-write="canWrite"
            class="flex min-h-0 flex-1 flex-col"
          />
        </div>
      </div>
    </template>
  </div>
</template>
