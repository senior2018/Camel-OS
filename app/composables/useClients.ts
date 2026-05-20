import type { ClientType, CreateClientPayload, UpdateClientPayload } from '@@/shared/schemas/client'

export interface ClientListItem {
  id: string
  name: string
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
      toast.add({ title: 'Client created', description: payload.name, color: 'success' })
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
