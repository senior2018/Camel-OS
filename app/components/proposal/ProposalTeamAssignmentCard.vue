<script setup lang="ts">
import {
  PROPOSAL_ASSIGNMENT_ROLE_LABEL,
  REVIEWER_ROLES,
  type ProposalAssignmentRole,
} from '@@/shared/schemas/proposal-assignment'

const props = withDefaults(
  defineProps<{
    proposalId: string
    canManageReview?: boolean
    canManageWriting?: boolean
  }>(),
  { canManageReview: false, canManageWriting: false }
)

const emit = defineEmits<{ changed: [] }>()

const { assignments, saveTeam } = useProposalReview(computed(() => props.proposalId))

interface TeamMember {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
}
const { data: teamData } = await useFetch<{ members: TeamMember[] }>('/api/users/assignable', {
  key: 'users-assignable',
  default: () => ({ members: [] }),
})
const userItems = computed(() =>
  (teamData.value?.members ?? []).map((m) => ({
    label: [m.firstName, m.lastName].filter(Boolean).join(' ') || m.email,
    value: m.id,
  }))
)
function nameOf(userId: string | null | undefined): string {
  if (!userId) return '—'
  return userItems.value.find((u) => u.value === userId)?.label ?? 'Unknown'
}

function holderOf(role: ProposalAssignmentRole): string | null {
  return assignments.value.find((a) => a.roleType === role)?.assignedUserId ?? null
}
function holdersOf(roles: ProposalAssignmentRole[]): string[] {
  return assignments.value.filter((a) => roles.includes(a.roleType)).map((a) => a.assignedUserId)
}

// ── Review team (manager) — Lead (1), Reviewers (N), Final Approver (1) ──
const leadDraft = ref<string | null>(null)
const reviewersDraft = ref<string[]>([])
const approverDraft = ref<string | null>(null)
// ── Writing team (lead) — Contributors (N) ──
const contributorsDraft = ref<string[]>([])

function sync() {
  leadDraft.value = holderOf('lead')
  reviewersDraft.value = holdersOf(REVIEWER_ROLES)
  approverDraft.value = holderOf('final_approver')
  contributorsDraft.value = holdersOf(['contributor'])
}
watch(assignments, sync, { immediate: true })

const savingReview = ref(false)
async function saveReview() {
  const list: { roleType: ProposalAssignmentRole; assignedUserId: string }[] = []
  if (leadDraft.value) list.push({ roleType: 'lead', assignedUserId: leadDraft.value })
  for (const id of reviewersDraft.value) list.push({ roleType: 'reviewer', assignedUserId: id })
  if (approverDraft.value)
    list.push({ roleType: 'final_approver', assignedUserId: approverDraft.value })
  savingReview.value = true
  const ok = await saveTeam('review', list)
  savingReview.value = false
  if (ok) emit('changed')
}

const savingWriting = ref(false)
async function saveWriting() {
  const list = contributorsDraft.value.map((id) => ({
    roleType: 'contributor' as ProposalAssignmentRole,
    assignedUserId: id,
  }))
  savingWriting.value = true
  const ok = await saveTeam('writing', list)
  savingWriting.value = false
  if (ok) emit('changed')
}

const reviewerCount = computed(() => holdersOf(REVIEWER_ROLES).length)
const contributorCount = computed(() => holdersOf(['contributor']).length)
</script>

<template>
  <UCard>
    <template #header>
      <h3 class="text-sm font-semibold text-default">Team</h3>
    </template>

    <div class="space-y-6">
      <!-- Review / management team -->
      <section class="space-y-3">
        <div class="flex items-center justify-between">
          <p class="text-xs font-semibold uppercase tracking-wide text-muted">Review team</p>
          <UBadge
            :color="reviewerCount >= 3 ? 'success' : 'warning'"
            variant="subtle"
            size="xs"
            :label="`${reviewerCount} reviewer${reviewerCount === 1 ? '' : 's'} · ≥3 to submit`"
          />
        </div>

        <template v-if="canManageReview">
          <UFormField label="Proposal Lead">
            <USelect
              v-model="leadDraft"
              :items="[{ label: 'Unassigned', value: null }, ...userItems]"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Reviewers (≥3 to submit)">
            <USelectMenu
              v-model="reviewersDraft"
              :items="userItems"
              value-key="value"
              multiple
              placeholder="Pick reviewers…"
              class="w-full"
            />
          </UFormField>
          <UFormField label="Final Approver">
            <USelect
              v-model="approverDraft"
              :items="[{ label: 'Unassigned', value: null }, ...userItems]"
              value-key="value"
              class="w-full"
            />
          </UFormField>
          <UButton :loading="savingReview" size="sm" label="Save review team" @click="saveReview" />
        </template>

        <div v-else class="space-y-1 text-sm">
          <p><span class="text-muted">Lead:</span> {{ nameOf(holderOf('lead')) }}</p>
          <p><span class="text-muted">Reviewers:</span> {{ reviewerCount }}</p>
          <p>
            <span class="text-muted">Final approver:</span> {{ nameOf(holderOf('final_approver')) }}
          </p>
        </div>
      </section>

      <!-- Writing team (manager or Lead) -->
      <section class="space-y-3 border-t border-default pt-4">
        <p class="text-xs font-semibold uppercase tracking-wide text-muted">
          Writing team — {{ PROPOSAL_ASSIGNMENT_ROLE_LABEL.contributor }}s
        </p>
        <!-- Only the Proposal Lead (or admin) staffs the writing team (PM-02). -->
        <template v-if="canManageWriting">
          <UFormField label="Writers (co-author the sections)">
            <USelectMenu
              v-model="contributorsDraft"
              :items="userItems"
              value-key="value"
              multiple
              placeholder="Add writers / co-authors…"
              class="w-full"
            />
          </UFormField>
          <UButton :loading="savingWriting" size="sm" label="Save writers" @click="saveWriting" />
          <p class="text-xs text-muted">
            Writers edit the proposal sections — keep them separate from the reviewers.
          </p>
        </template>
        <template v-else>
          <p v-if="canManageReview" class="text-xs text-muted">
            Writers are chosen by the <span class="font-medium text-default">Proposal Lead</span> —
            assign the Lead above, then they add the writing team here. (Don't put writers in the
            Reviewers list.)
          </p>
          <div class="flex flex-wrap gap-1">
            <UBadge
              v-for="cid in holdersOf(['contributor'])"
              :key="cid"
              variant="subtle"
              color="neutral"
              size="xs"
              :label="nameOf(cid)"
            />
            <span v-if="!contributorCount" class="text-sm text-muted">No writers yet.</span>
          </div>
        </template>
      </section>
    </div>
  </UCard>
</template>
