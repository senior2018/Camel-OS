import type { InviteUserPayload } from '@@/shared/schemas/admin'

export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  status: 'active' | 'suspended' | 'pending_verification'
  deactivatedAt: string | null
  emailVerifiedAt: string | null
  lockedUntil: string | null
  createdAt: string
  roles: Array<{ id: string; name: string }>
}

export interface PendingInvitation {
  id: string
  email: string
  firstName: string
  lastName: string
  expiresAt: string
  createdAt: string
}

interface AdminUsersResponse {
  users: AdminUser[]
  pendingInvitations: PendingInvitation[]
}

/**
 * Owns all admin-side user management: the list fetch, invite, deactivate,
 * reactivate, and invitation revoke/resend actions. Toast feedback and refresh
 * are wired in here so the page component stays focused on layout.
 */
export function useAdminUsers() {
  const toast = useToast()

  const { data, refresh, status, error } = useFetch<AdminUsersResponse>('/api/admin/users', {
    key: 'admin-users-list',
    default: () => ({ users: [], pendingInvitations: [] }),
  })

  function extractMessage(err: unknown, fallback: string) {
    return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  async function inviteUser(payload: InviteUserPayload): Promise<boolean> {
    try {
      await $fetch('/api/admin/users/invite', { method: 'POST', body: payload })
      toast.add({
        title: 'Invitation sent',
        description: `${payload.email} will receive an email to set their password.`,
        color: 'success',
      })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Invite failed',
        description: extractMessage(err, 'Could not send invitation.'),
        color: 'error',
      })
      return false
    }
  }

  async function deactivateUser(user: AdminUser) {
    try {
      await $fetch(`/api/admin/users/${user.id}/deactivate`, { method: 'POST' })
      toast.add({ title: 'User deactivated', description: user.email, color: 'success' })
      await refresh()
    } catch (err) {
      toast.add({
        title: 'Failed',
        description: extractMessage(err, 'Could not deactivate.'),
        color: 'error',
      })
    }
  }

  async function reactivateUser(user: AdminUser) {
    try {
      await $fetch(`/api/admin/users/${user.id}/reactivate`, { method: 'POST' })
      toast.add({ title: 'User reactivated', description: user.email, color: 'success' })
      await refresh()
    } catch (err) {
      toast.add({
        title: 'Failed',
        description: extractMessage(err, 'Could not reactivate.'),
        color: 'error',
      })
    }
  }

  async function revokeInvitation(invite: PendingInvitation) {
    try {
      await $fetch(`/api/admin/invitations/${invite.id}/revoke`, { method: 'POST' })
      toast.add({ title: 'Invitation revoked', description: invite.email, color: 'success' })
      await refresh()
    } catch (err) {
      toast.add({
        title: 'Failed',
        description: extractMessage(err, 'Could not revoke.'),
        color: 'error',
      })
    }
  }

  async function resendInvitation(invite: PendingInvitation) {
    try {
      await $fetch(`/api/admin/invitations/${invite.id}/resend`, { method: 'POST' })
      toast.add({ title: 'Invitation resent', description: invite.email, color: 'success' })
      await refresh()
    } catch (err) {
      toast.add({
        title: 'Failed',
        description: extractMessage(err, 'Could not resend.'),
        color: 'error',
      })
    }
  }

  return {
    data,
    status,
    error,
    refresh,
    inviteUser,
    deactivateUser,
    reactivateUser,
    revokeInvitation,
    resendInvitation,
  }
}
