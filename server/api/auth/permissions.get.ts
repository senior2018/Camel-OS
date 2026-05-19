import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { organizationMembers, roles, userRoles, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { getUserPermissions, userHasPermission } from '@@/server/utils/role'

/**
 * Lightweight session-scoped read the UI uses to gate menu items, page sections,
 * and conditional buttons. Real authorization always happens server-side via
 * `requireAdmin()` / `requirePermission()`; this endpoint is safe to expose
 * because it returns only what the user can already do.
 *
 * Returns:
 *  - `isAdmin` — convenience flag for the admin nav section
 *  - `adminLevel` — how they qualified (legacy fields or new RBAC)
 *  - `roles` — assigned role names for the dashboard's account summary
 *  - `permissions` — map of `module → action[]` for `can()` checks in the UI
 */
export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session.user) {
      return emptyResponse()
    }
    const sessionUser = session.user as { id: string }
    const db = useDrizzle()

    const [userRow] = await db
      .select({
        id: users.id,
        organizationId: users.organizationId,
        systemRole: users.role,
      })
      .from(users)
      .where(eq(users.id, sessionUser.id))
      .limit(1)

    if (!userRow) return emptyResponse()

    const [assignedRoles, permsSet] = await Promise.all([
      db
        .select({ id: roles.id, name: roles.name })
        .from(userRoles)
        .innerJoin(roles, eq(roles.id, userRoles.roleId))
        .where(eq(userRoles.userId, userRow.id)),
      getUserPermissions(userRow.id),
    ])

    // Flatten the Set<`${module}:${action}`> into a `module → action[]` map for
    // ergonomic `can()` lookups on the client.
    const permissions: Record<string, string[]> = {}
    for (const entry of permsSet) {
      const [module, action] = entry.split(':') as [string, string]
      if (!permissions[module]) permissions[module] = []
      permissions[module].push(action)
    }

    const base = { roles: assignedRoles, permissions }

    if (userRow.systemRole === 'system_admin') {
      return { isAdmin: true, adminLevel: 'system_admin' as const, ...base }
    }

    const [membership] = await db
      .select({ role: organizationMembers.role })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.userId, userRow.id),
          eq(organizationMembers.organizationId, userRow.organizationId)
        )
      )
      .limit(1)

    if (membership?.role === 'owner' || membership?.role === 'admin') {
      return { isAdmin: true, adminLevel: membership.role, ...base }
    }

    if (await userHasPermission(userRow.id, 'admin', 'admin')) {
      return { isAdmin: true, adminLevel: 'role' as const, ...base }
    }

    return { isAdmin: false, ...base }
  } catch (error) {
    consola.error('Error fetching permissions', error)
    return emptyResponse()
  }
})

function emptyResponse() {
  return { isAdmin: false, roles: [], permissions: {} as Record<string, string[]> }
}
