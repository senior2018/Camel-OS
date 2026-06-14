import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { userSessions, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Soft-delete a user. We never hard-delete: the row is kept (so audit-log and
 * `created_by` attribution stay intact — no "Unknown user" three months later),
 * `deactivated_at` is stamped to remove all access, and active sessions are
 * revoked so the user is logged out immediately. Re-activating clears the stamp.
 *
 * Guards:
 *   - You can never delete yourself.
 *   - You can never delete the super admin (transfer the role first).
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const targetId = getRouterParam(event, 'id')
    if (!targetId) throw createError({ statusCode: 400, statusMessage: 'User id required' })

    if (targetId === admin.userId) {
      throw createError({ statusCode: 400, statusMessage: 'You cannot delete yourself.' })
    }

    const db = useDrizzle()

    const [target] = await db
      .select({
        id: users.id,
        email: users.email,
        role: users.role,
        isSuperAdmin: users.isSuperAdmin,
      })
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.organizationId, admin.organizationId)))
      .limit(1)
    if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' })

    if (target.isSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'The super admin cannot be deleted. Transfer the role first.',
      })
    }

    // S5b — only the super admin can delete another admin. Regular admins can
    // delete normal users but not their peers; preserves a chain of authority.
    const [me] = await db
      .select({ isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(eq(users.id, admin.userId))
      .limit(1)
    const targetIsAdmin = target.role === 'system_admin' || target.role === 'org_admin'
    if (targetIsAdmin && !me?.isSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the super admin can delete another admin.',
      })
    }

    // Soft delete: stamp deactivatedAt (keeps the row + attribution) and revoke
    // every active session so access is cut immediately.
    await db
      .update(users)
      .set({ deactivatedAt: new Date(), updatedAt: new Date() })
      .where(eq(users.id, target.id))
    await db.delete(userSessions).where(eq(userSessions.userId, target.id))

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user',
      action: 'soft_delete',
      resourceId: target.id,
      meta: { targetEmail: target.email, by: admin.email },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting user', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
