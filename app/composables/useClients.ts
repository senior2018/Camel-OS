import type { ClientType, CreateClientPayload, UpdateClientPayload } from '@@/shared/schemas/client'

export interface ClientListItem {
  id: string
  name: string
  firstName: string | null
  lastName: string | null
  organization: string | null
  type: ClientType
  industry: string | null
  country: string | null
  website: string | null
  phone: string | null
  email: string | null
  ownerUserId: string | null
  ownerEmail: string | null
  ownerFirstName: string | null
  ownerLastName: string | null
  createdAt: string
  updatedAt: string
  interactionCount: number
  lastInteractionAt: string | null
  opportunityCount: number
}

interface ClientsResponse {
  items: ClientListItem[]
}

interface DuplicateError {
  data?: { duplicates?: Array<{ id: string; name: string; email: string | null }> }
  statusCode?: number
}

export interface CreateClientResult {
  client?: ClientListItem
  duplicates?: Array<{ id: string; name: string; email: string | null }>
  error?: string
}

/**
 * CR-04 — bucket a client's recency-of-interaction into a colour-coded health
 * level. "Healthy" = touched in the last fortnight, "Warm" = within two months,
 * "At risk" = no contact for 60+ days (or never). Used by both the list page
 * (filter chip + dot indicator) and the detail header.
 */
export type ClientHealth = 'healthy' | 'warm' | 'at_risk'

export const CLIENT_HEALTH_LABEL: Record<ClientHealth, string> = {
  healthy: 'Healthy',
  warm: 'Warm',
  at_risk: 'At risk',
}

export function clientHealth(lastInteractionAt: string | null): ClientHealth {
  if (!lastInteractionAt) return 'at_risk'
  const days = Math.floor((Date.now() - new Date(lastInteractionAt).getTime()) / 86_400_000)
  if (days < 14) return 'healthy'
  if (days < 60) return 'warm'
  return 'at_risk'
}

/**
 * Owns the clients list state and every mutation. Toast feedback lives here so
 * pages stay focused on layout. Duplicate detection on create returns the
 * existing matches so the modal can offer "open existing".
 */
export function useClients() {
  const toast = useToast()

  const { data, refresh, status, error } = useFetch<ClientsResponse>('/api/clients', {
    key: 'clients-list',
  })

  function extractMessage(err: unknown, fallback: string) {
    return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  async function createClient(payload: CreateClientPayload): Promise<CreateClientResult> {
    try {
      const res = await $fetch<{ success: boolean; client: ClientListItem }>('/api/clients', {
        method: 'POST',
        body: payload,
      })
      toast.add({ title: 'Client created', description: res.client.name, color: 'success' })
      await refresh()
      return { client: res.client }
    } catch (err) {
      const e = err as DuplicateError
      if (e.statusCode === 409 && e.data?.duplicates?.length) {
        return { duplicates: e.data.duplicates }
      }
      const message = extractMessage(err, 'Please try again.')
      toast.add({ title: 'Could not create client', description: message, color: 'error' })
      return { error: message }
    }
  }

  async function updateClient(id: string, payload: UpdateClientPayload): Promise<boolean> {
    try {
      await $fetch(`/api/clients/${id}`, { method: 'PATCH', body: payload })
      toast.add({ title: 'Client updated', color: 'success' })
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

  async function deleteClient(client: ClientListItem): Promise<boolean> {
    try {
      await $fetch(`/api/clients/${client.id}`, { method: 'DELETE' })
      toast.add({ title: 'Client deleted', description: client.name, color: 'success' })
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

  return {
    data,
    status,
    error,
    refresh,
    createClient,
    updateClient,
    deleteClient,
  }
}
