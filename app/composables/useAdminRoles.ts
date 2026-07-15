import type { UpsertRolePayload } from '@@/shared/schemas/role'

export interface AdminRoleSummary {
  id: string
  name: string
  description: string | null
  mfaRequired: boolean
  isSystem: boolean
  createdAt: string
  permissionCount: number
  memberCount: number
}

export interface AdminRoleDetail {
  role: {
    id: string
    organizationId: string
    name: string
    description: string | null
    mfaRequired: boolean
    isSystem: boolean
    createdAt: string
    updatedAt: string
  }
  permissions: Array<{ module: string; action: string }>
}

/**
 * Owns the roles list state and all CRUD actions. The role-editor modal pulls the
 * detailed `getRole` for an existing role; create/update use the same payload shape.
 */
export function useAdminRoles() {
  const toast = useToast()

  const { data, refresh, status, error } = useFetch<{ roles: AdminRoleSummary[] }>(
    '/api/admin/roles',
    { key: 'admin-roles-list', default: () => ({ roles: [] }) }
  )

  function extractMessage(err: unknown, fallback: string) {
    return (err as { data?: { statusMessage?: string } })?.data?.statusMessage ?? fallback
  }

  async function getRole(id: string): Promise<AdminRoleDetail | null> {
    try {
      return await $fetch<AdminRoleDetail>(`/api/admin/roles/${id}`)
    } catch (err) {
      toast.add({
        title: 'Failed to load role',
        description: extractMessage(err, 'Could not load role.'),
        color: 'error',
      })
      return null
    }
  }

  async function createRole(payload: UpsertRolePayload): Promise<boolean> {
    try {
      await $fetch('/api/admin/roles', { method: 'POST', body: payload })
      toast.add({ title: 'Role created', description: payload.name, color: 'success' })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Failed to create role',
        description: extractMessage(err, 'Could not create role.'),
        color: 'error',
      })
      return false
    }
  }

  async function updateRole(id: string, payload: UpsertRolePayload): Promise<boolean> {
    try {
      await $fetch(`/api/admin/roles/${id}`, { method: 'PATCH', body: payload })
      toast.add({ title: 'Role updated', description: payload.name, color: 'success' })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Failed to update role',
        description: extractMessage(err, 'Could not update role.'),
        color: 'error',
      })
      return false
    }
  }

  async function deleteRole(role: AdminRoleSummary): Promise<boolean> {
    try {
      await $fetch(`/api/admin/roles/${role.id}`, { method: 'DELETE' })
      toast.add({ title: 'Role deleted', description: role.name, color: 'success' })
      await refresh()
      return true
    } catch (err) {
      toast.add({
        title: 'Failed to delete role',
        description: extractMessage(err, 'Could not delete role.'),
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
    getRole,
    createRole,
    updateRole,
    deleteRole,
  }
}
