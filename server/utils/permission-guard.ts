import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'

import { users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { userHasPermission } from './role'
import type { PermissionAction } from '@@/shared/permissions'

export interface PermissionContext {
  userId: string
  organizationId: string
  email: string
  // True for the legacy system-admin (god-mode). Lets endpoints apply an
  // admin bypass on record-level checks (e.g. edit any opportunity) without a
  // second query.
  isSystemAdmin: boolean
}

/**
 * Asserts the current session user has `action` on `module` via any of their
 * roles. Throws 401 if not authenticated, 403 if the permission is missing.
 *
 * Use this at the top of every protected API endpoint that isn't already
 * gated by `requireAdmin()`. Example:
 *
 *   const { userId, organizationId } = await requirePermission(event, 'opportunity', 'create')
 *
 * Granting `admin` on a module implicitly grants every other action on that
 * module (handled inside `userHasPermission`).
 */
export async function requirePermission(
  event: H3Event,
  module: string,
  action: PermissionAction
): Promise<PermissionContext> {
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

  // The legacy system-admin flag retains its god-mode bypass for now.
  if (userRow.systemRole === 'system_admin') {
    return {
      userId: userRow.id,
      organizationId: userRow.organizationId,
      email: userRow.email,
      isSystemAdmin: true,
    }
  }

  if (await userHasPermission(userRow.id, module, action)) {
    return {
      userId: userRow.id,
      organizationId: userRow.organizationId,
      email: userRow.email,
      isSystemAdmin: false,
    }
  }

  throw createError({
    statusCode: 403,
    statusMessage: `You don't have permission to ${action} ${module}.`,
  })
}
