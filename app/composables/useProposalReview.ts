import type { Ref } from 'vue'
import type {
  ProposalAssignmentRole,
  CreateProposalAssignmentPayload,
  SaveProposalAssignmentsPayload,
} from '@@/shared/schemas/proposal-assignment'
import type { SubmitProposalReviewPayload } from '@@/shared/schemas/proposal-review'

interface Reviewer {
  id: string
  reviewerUserId: string
  reviewerRole: ProposalAssignmentRole
  isRequired: boolean
  status: 'pending' | 'approved' | 'changes_required' | 'rejected'
  feedback: string | null
  decidedAt: string | null
  createdAt: string
  userEmail: string
  userFirstName: string | null
  userLastName: string | null
}

interface Assignment {
  id: string
  roleType: ProposalAssignmentRole
  assignedUserId: string
  assignedAt: string
  assignedUserEmail: string
  assignedUserFirstName: string | null
  assignedUserLastName: string | null
}

export function useProposalReview(proposalId: Ref<string>) {
  const toast = useToast()

  const { data: reviewersData, refresh: refreshReviewers } = useFetch<{ reviewers: Reviewer[] }>(
    () => `/api/proposals/${proposalId.value}/reviewers`,
    {
      key: () => `proposal-reviewers-${proposalId.value}`,
      default: () => ({ reviewers: [] }),
    }
  )

  const { data: assignmentsData, refresh: refreshAssignments } = useFetch<{
    assignments: Assignment[]
  }>(() => `/api/proposals/${proposalId.value}/assignments`, {
    key: () => `proposal-assignments-${proposalId.value}`,
    default: () => ({ assignments: [] }),
  })

  async function assignTeamMember(payload: CreateProposalAssignmentPayload): Promise<boolean> {
    try {
      await $fetch(`/api/proposals/${proposalId.value}/assignments`, {
        method: 'POST',
        body: payload,
      })
      toast.add({
        title: 'Team member assigned',
        color: 'success',
      })
      await refreshAssignments()
      return true
    } catch (err) {
      const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
      toast.add({
        title: 'Assignment failed',
        description: msg,
        color: 'error',
      })
      return false
    }
  }

  async function saveAssignments(payload: SaveProposalAssignmentsPayload): Promise<boolean> {
    try {
      await $fetch(`/api/proposals/${proposalId.value}/assignments`, {
        method: 'PUT',
        body: payload,
      })
      toast.add({ title: 'Team saved', color: 'success' })
      await refreshAssignments()
      return true
    } catch (err) {
      const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
      toast.add({ title: 'Could not save team', description: msg, color: 'error' })
      return false
    }
  }

  async function submitReview(payload: SubmitProposalReviewPayload): Promise<boolean> {
    try {
      await $fetch(`/api/proposals/${proposalId.value}/review`, {
        method: 'POST',
        body: payload,
      })
      toast.add({
        title: 'Review submitted',
        color: 'success',
      })
      await refreshReviewers()
      return true
    } catch (err) {
      const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
      toast.add({
        title: 'Review submission failed',
        description: msg,
        color: 'error',
      })
      return false
    }
  }

  async function markReadyForReview(): Promise<boolean> {
    try {
      await $fetch(`/api/proposals/${proposalId.value}/ready-for-review`, {
        method: 'POST',
      })
      toast.add({
        title: 'Proposal marked ready for review',
        color: 'success',
      })
      return true
    } catch (err) {
      const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
      toast.add({
        title: 'Could not mark ready',
        description: msg,
        color: 'error',
      })
      return false
    }
  }

  return {
    reviewers: computed(() => reviewersData.value?.reviewers ?? []),
    assignments: computed(() => assignmentsData.value?.assignments ?? []),
    refreshReviewers,
    refreshAssignments,
    assignTeamMember,
    saveAssignments,
    submitReview,
    markReadyForReview,
  }
}
