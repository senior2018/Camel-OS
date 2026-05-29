import type { PermissionAction } from '@@/shared/permissions'

interface PermissionsResponse {
  isAdmin: boolean
  /** S5b — true for the single super admin per org. Distinct from `isAdmin`. */
  isSuperAdmin: boolean
  adminLevel?: 'system_admin' | 'owner' | 'admin' | 'role'
  roles: Array<{ id: string; name: string }>
  /** Map of `module → action[]` the current user has been granted by their roles. */
  permissions: Record<string, string[]>
}

/**
 * Session-scoped permission state shared across the layout, pages, and components.
 *
 * UI gating pattern:
 *  ```ts
 *  const { can, isAdmin } = await usePermissions()
 *  if (can.value('opportunity', 'create')) { ... }
 *  ```
 * The composable returns a single fetch (deduped via key) plus a reactive `can()`
 * helper. The server is still the authoritative gate — use `requirePermission()`
 * in every API handler.
 */
export async function usePermissions() {
  const fetchResult = await useFetch<PermissionsResponse>('/api/auth/permissions', {
    key: 'auth-permissions',
    default: () => ({ isAdmin: false, isSuperAdmin: false, roles: [], permissions: {} }),
  })

  /**
   * Returns true when the current user has been granted `action` on `module` via
   * any of their roles. The `admin` action on a module implies every action on
   * that module (a system-admin shortcut).
   */
  const can = computed(() => (module: string, action: PermissionAction): boolean => {
    const perms = fetchResult.data.value?.permissions?.[module] ?? []
    return perms.includes(action) || perms.includes('admin')
  })

  const isAdmin = computed(() => fetchResult.data.value?.isAdmin === true)

  return {
    ...fetchResult,
    can,
    isAdmin,
  }
}
