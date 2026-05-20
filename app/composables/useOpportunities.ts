import type {
  CreateOpportunityPayload,
  OpportunityStage,
  OpportunitySource,
  OpportunityType,
  UpdateOpportunityPayload,
} from '@@/shared/schemas/opportunity'

export interface Opportunity {
  id: string
  title: string
  source: OpportunitySource
  type: OpportunityType
  stage: OpportunityStage
  deadline: string | null
  estimatedValue: string | null
  currency: string
  winProbability: number | null
  primaryClientId: string | null
  primaryClientName: string | null
  ownerUserId: string | null
  ownerEmail: string | null
  ownerFirstName: string | null
  ownerLastName: string | null
  approvedToPursueAt: string | null
  createdAt: string
  updatedAt: string
}

interface OpportunitiesResponse {
  items: Opportunity[]
  grouped: Record<OpportunityStage, Opportunity[]>
}

/**
 * Owns the opportunities list state and every mutation. Toast feedback is wired
 * here so pages stay focused on layout. Real authorization is server-side via
 * `requirePermission()`; the UI uses `can('opportunity', ...)` for visibility.
 */
export function useOpportunities() {
  const toast = useToast()

  const { data, refresh, status, error } = useFetch<OpportunitiesResponse>('/api/opportunities', {
    key: 'opportunities-list',
  })

  function extractMessage(err: unknown, fallback: string) {
    return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  async function createOpportunity(payload: CreateOpportunityPayload): Promise<Opportunity | null> {
    try {
      const res = await $fetch<{ success: boolean; opportunity: Opportunity }>(
        '/api/opportunities',
        { method: 'POST', body: payload }
      )
      toast.add({ title: 'Opportunity created', description: payload.title, color: 'success' })
      await refresh()
      return res.opportunity
    } catch (err) {
      toast.add({
        title: 'Could not create opportunity',
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
      return null
    }
  }

  async function updateOpportunity(
    id: string,
    payload: UpdateOpportunityPayload
  ): Promise<boolean> {
    try {
      await $fetch(`/api/opportunities/${id}`, { method: 'PATCH', body: payload })
      toast.add({ title: 'Opportunity updated', color: 'success' })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Update failed',
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
      return false
    }
  }

  async function deleteOpportunity(opp: Opportunity): Promise<boolean> {
    try {
      await $fetch(`/api/opportunities/${opp.id}`, { method: 'DELETE' })
      toast.add({ title: 'Opportunity deleted', description: opp.title, color: 'success' })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Delete failed',
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
      return false
    }
  }

  async function setApproved(opp: Opportunity, approved: boolean): Promise<boolean> {
    try {
      await $fetch(`/api/opportunities/${opp.id}/approve`, {
        method: 'POST',
        body: { approved },
      })
      toast.add({
        title: approved ? 'Marked as approved to pursue' : 'Approval revoked',
        description: opp.title,
        color: 'success',
      })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Approval update failed',
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
      return false
    }
  }

  async function moveStage(
    opp: Opportunity,
    toStage: OpportunityStage,
    note?: string
  ): Promise<boolean> {
    if (opp.stage === toStage) return true
    try {
      await $fetch(`/api/opportunities/${opp.id}/stage`, {
        method: 'POST',
        body: { stage: toStage, note },
      })
      toast.add({
        title: 'Stage updated',
        description: `${opp.title} → ${toStage}`,
        color: 'success',
      })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Could not move stage',
        description: extractMessage(err, 'Please try again.'),
        color: 'error',
      })
      return false
    }
  }

  return {
    data,
    status,
    error,
    refresh,
    createOpportunity,
    updateOpportunity,
    deleteOpportunity,
    moveStage,
    setApproved,
  }
}
