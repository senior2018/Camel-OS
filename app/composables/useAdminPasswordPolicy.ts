import type { PasswordPolicy } from '@@/shared/schemas/password-policy'

/**
 * Loads and persists the org's password policy. The PUT endpoint validates the
 * payload server-side; the UI binds directly to the returned policy object.
 */
export function useAdminPasswordPolicy() {
  const toast = useToast()

  const { data, refresh, status, error } = useFetch<{ policy: PasswordPolicy }>(
    '/api/admin/password-policy',
    { key: 'admin-password-policy', default: () => ({ policy: null as unknown as PasswordPolicy }) }
  )

  async function savePolicy(payload: PasswordPolicy): Promise<boolean> {
    try {
      await $fetch('/api/admin/password-policy', { method: 'PUT', body: payload })
      toast.add({ title: 'Password policy updated', color: 'success' })
      await refresh()
      return true
    } catch (err) {
      const msg =
        (err as { data?: { statusMessage?: string } })?.data?.statusMessage ??
        'Could not save policy.'
      toast.add({ title: 'Failed', description: msg, color: 'error' })
      return false
    }
  }

  return { data, status, error, refresh, savePolicy }
}
