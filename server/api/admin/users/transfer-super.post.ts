import { consola } from 'consola'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { useDrizzle } from '@@/server/utils/drizzle'
import { users } from '@@/server/database/schema'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * S5b — transfer the super-admin flag to another user in the org.
 *
 * Only the current super admin can perform this transfer. We require them to
 * re-confirm with their password (defence against an open session being used
 * to silently demote themselves). The transfer is atomic: in one TX we demote
 * the current super and promote the target. The user calling this endpoint
 * loses super-admin status immediately and must rely on the new super admin
 * for any super-only future operations.
 */
const schema = z.object({
  toUserId: z.string().uuid(),
  currentPassword: z.string().min(1, 'Password confirmation is required'),
})

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const parsed = schema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }

    const db = useDrizzle()

    // Only the current super admin can call this — even other admins are blocked.
    const [me] = await db
      .select({ id: users.id, isSuperAdmin: users.isSuperAdmin, email: users.email })
      .from(users)
      .where(eq(users.id, admin.userId))
      .limit(1)
    if (!me?.isSuperAdmin) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the super admin can transfer this role.',
      })
    }

    // Re-confirm with password — uses the same verify path as normal login.
    const [localAccount] = await findAuthAccountByUserIdAndProvider(admin.userId, 'local')
    if (!localAccount?.passwordHash) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Password confirmation unavailable for this account type.',
      })
    }
    const ok = await verifyPassword(localAccount.passwordHash, parsed.data.currentPassword)
    if (!ok) {
      throw createError({ statusCode: 401, statusMessage: 'Password did not match.' })
    }

    // Validate target is in the same org and isn't the current super already.
    const [target] = await db
      .select({ id: users.id, email: users.email, isSuperAdmin: users.isSuperAdmin })
      .from(users)
      .where(
        and(eq(users.id, parsed.data.toUserId), eq(users.organizationId, admin.organizationId))
      )
      .limit(1)
    if (!target) {
      throw createError({ statusCode: 404, statusMessage: 'Target user not found.' })
    }
    if (target.id === me.id) {
      throw createError({ statusCode: 400, statusMessage: 'Target is already the super admin.' })
    }

    await db.transaction(async (tx) => {
      await tx.update(users).set({ isSuperAdmin: false }).where(eq(users.id, me.id))
      await tx.update(users).set({ isSuperAdmin: true }).where(eq(users.id, target.id))
      // The new super admin gets MFA forced — they can re-enroll on next login
      // if they haven't yet, since this is now the highest-privilege account.
      await tx.update(users).set({ mfaRequired: true }).where(eq(users.id, target.id))
    })

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user',
      action: 'super_admin_transferred',
      resourceId: target.id,
      meta: { fromEmail: me.email, toEmail: target.email },
    })

    return { success: true, newSuperAdminEmail: target.email }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error transferring super admin', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
