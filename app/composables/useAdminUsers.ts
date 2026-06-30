import type { InviteUserPayload } from '@@/shared/schemas/admin'

export interface AdminUser {
  id: string
  email: string
  firstName: string
  lastName: string
  role: 'system_admin' | 'org_admin' | 'member'
  status: 'active' | 'suspended' | 'pending_verification'
  deactivatedAt: string | null
  emailVerifiedAt: string | null
  lockedUntil: string | null
  isSuperAdmin: boolean
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
  callerIsSuperAdmin: boolean
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
    default: () => ({ users: [], pendingInvitations: [], callerIsSuperAdmin: false }),
  })

  function extractMessage(err: unknown, fallback: string) {
    return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  async function inviteUser(payload: InviteUserPayload): Promise<boolean> {
    try {
      const res = await $fetch<{ emailSent?: boolean; emailError?: string | null }>(
        '/api/admin/users/invite',
        { method: 'POST', body: payload }
      )
      if (res.emailSent === false) {
        // The invitation exists, but the email didn't go out — warn honestly so
        // the admin can resend or check Brevo rather than assume it arrived.
        toast.add({
          title: 'Invite created, but email failed',
          description: `${payload.email} was not emailed: ${res.emailError ?? 'mail service error'}. Use Resend after fixing email settings.`,
          color: 'warning',
        })
      } else {
        toast.add({
          title: 'Invitation sent',
          description: `${payload.email} will receive an email to set their password.`,
          color: 'success',
        })
      }
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

  async function deleteUser(user: AdminUser): Promise<boolean> {
    try {
      await $fetch(`/api/admin/users/${user.id}`, { method: 'DELETE' })
      toast.add({ title: 'User deleted', description: user.email, color: 'success' })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Could not delete',
        description: extractMessage(err, 'Delete failed.'),
        color: 'error',
      })
      return false
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
      const res = await $fetch<{ emailSent?: boolean; emailError?: string | null }>(
        `/api/admin/invitations/${invite.id}/resend`,
        { method: 'POST' }
      )
      if (res.emailSent === false) {
        toast.add({
          title: 'Resend failed',
          description: `Email to ${invite.email} did not send: ${res.emailError ?? 'mail service error'}.`,
          color: 'warning',
        })
      } else {
        toast.add({ title: 'Invitation resent', description: invite.email, color: 'success' })
      }
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
    deleteUser,
    reactivateUser,
    revokeInvitation,
    resendInvitation,
  }
}
