import type { Ref } from 'vue'
import type { CreateOpportunityDecisionPayload } from '@@/shared/schemas/opportunity-decision'

interface OpportunityDecision {
  id: string
  opportunityId: string
  organizationId: string
  status: 'pending' | 'approved' | 'rejected'
  decisionReason: string | null
  decidedByUserId: string | null
  decidedAt: string | null
  createdAt: string
}

export function useOpportunityDecision(opportunityId: Ref<string>) {
  const toast = useToast()

  const { data, refresh } = useFetch<{ decision: OpportunityDecision | null }>(
    () => `/api/opportunities/${opportunityId.value}/decision`,
    {
      key: () => `opportunity-decision-${opportunityId.value}`,
      default: () => ({ decision: null }),
    }
  )

  const decision = computed(() => data.value?.decision)

  async function makeDecision(payload: CreateOpportunityDecisionPayload): Promise<boolean> {
    try {
      await $fetch(`/api/opportunities/${opportunityId.value}/decision`, {
        method: 'POST',
        body: payload,
      })
      toast.add({
        title: `Decision made: ${payload.status === 'approved' ? 'Approved' : 'Rejected'}`,
        color: 'success',
      })
      await refresh()
      return true
    } catch (err) {
      const msg = (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? 'Failed'
      toast.add({
        title: 'Could not make decision',
        description: msg,
        color: 'error',
      })
      return false
    }
  }

  return {
    decision,
    refresh,
    makeDecision,
  }
}
