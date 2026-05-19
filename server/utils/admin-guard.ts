import { and, eq } from 'drizzle-orm'
import type { H3Event } from 'h3'

import { organizationMembers, users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { userHasPermission } from './role'

export interface AdminContext {
  userId: string
  organizationId: string
  email: string
  /**
   * How the user qualifies as an admin:
   *  - `system_admin` — legacy `users.role` flag (bootstrap seed)
   *  - `owner` | `admin` — legacy `organization_members.role` (bootstrap seed)
   *  - `role` — granted via the new RBAC: a role with `admin:admin` permission
   */
  adminLevel: 'system_admin' | 'owner' | 'admin' | 'role'
}

/**
 * Throws 401 if not authenticated, 403 if the session user is not an admin in their
 * organization. Returns the session user's admin context on success.
 *
 * Used by every `/api/admin/*` endpoint as the first call inside the handler.
 */
export async function requireAdmin(event: H3Event): Promise<AdminContext> {
  const session = await getUserSession(event)
  if (!session.user) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  const sessionUser = session.user as { id: string; email: string }

  const [userRow] = await useDrizzle()
    .select({
      id: users.id,
      email: users.email,
      organizationId: users.organizationId,
      systemRole: users.role,
    })
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)

  if (!userRow) {
    throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
  }

  if (userRow.systemRole === 'system_admin') {
    return {
      userId: userRow.id,
      organizationId: userRow.organizationId,
      email: userRow.email,
      adminLevel: 'system_admin',
    }
  }

  const [membership] = await useDrizzle()
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
    return {
      userId: userRow.id,
      organizationId: userRow.organizationId,
      email: userRow.email,
      adminLevel: membership.role,
    }
  }

  // Role-based RBAC check — any role granting `admin:admin` qualifies.
  if (await userHasPermission(userRow.id, 'admin', 'admin')) {
    return {
      userId: userRow.id,
      organizationId: userRow.organizationId,
      email: userRow.email,
      adminLevel: 'role',
    }
  }

  throw createError({ statusCode: 403, statusMessage: 'Admin access required' })
}
