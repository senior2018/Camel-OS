import { z } from 'zod'
import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'

import { useDrizzle } from '@@/server/utils/drizzle'
import { authAccounts, passwordResetTokens, users } from '@@/server/database/schema'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { recordPasswordHistory } from '@@/server/utils/password-policy'
import { sha256 } from '@@/server/utils/crypto'
import { sendPasswordResetEmail } from '@@/server/utils/mailer'

/**
 * S7 — Admin-driven password reset. Two modes:
 *
 *  1. `email_link` (default, recommended) — sends a single-use reset link to the
 *     user; they click it and set their own password. The admin never sees the
 *     password. Mirrors the public /forgot-password flow but auditable as an
 *     admin action.
 *
 *  2. `auto` — generates a temporary password, flips `mustChangePassword`, and
 *     returns the password to the admin so they can hand it over in person
 *     when email is unreliable. The user is forced to change it on next login.
 *
 * Super-admin shield mirrors the existing edit endpoint.
 */
const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour — same window as the public flow

const schema = z.object({
  mode: z.enum(['email_link', 'auto']).default('email_link'),
})

function generateTempPassword(): string {
  // 12 base64url chars ≈ 72 bits — plenty for a single-use throwaway.
  return randomBytes(9).toString('base64url')
}

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const targetId = getRouterParam(event, 'id')
    if (!targetId) throw createError({ statusCode: 400, statusMessage: 'User id required' })

    const parsed = schema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }

    const db = useDrizzle()
    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.organizationId, admin.organizationId)))
      .limit(1)
    if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' })

    if (target.isSuperAdmin && admin.userId !== target.id) {
      throw createError({
        statusCode: 403,
        statusMessage: "You cannot reset the super admin's password.",
      })
    }

    const [localAccount] = await findAuthAccountByUserIdAndProvider(target.id, 'local')
    if (!localAccount) {
      throw createError({
        statusCode: 400,
        statusMessage: 'This user does not have a local password to reset.',
      })
    }

    // ── Mode 1: email a single-use reset link ──────────────────────────────────
    if (parsed.data.mode === 'email_link') {
      const rawToken = randomBytes(32).toString('hex')
      const tokenHash = sha256(rawToken)
      const expiresAt = new Date(Date.now() + RESET_TTL_MS)

      await db.insert(passwordResetTokens).values({
        userId: target.id,
        tokenHash,
        expiresAt,
      })

      const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
      const resetUrl = `${appUrl}/reset-password?token=${rawToken}`

      await sendPasswordResetEmail(target.email, resetUrl)

      await logAuditEvent({
        organizationId: admin.organizationId,
        userId: admin.userId,
        resource: 'user',
        action: 'admin_password_reset',
        resourceId: target.id,
        meta: { mode: 'email_link', targetEmail: target.email },
      })

      return {
        success: true,
        mode: 'email_link' as const,
        sentToEmail: target.email,
      }
    }

    // ── Mode 2: auto-generate temp password (shown once to the admin) ─────────
    const tempPassword = generateTempPassword()
    const newHash = await hashPassword(tempPassword)
    const now = new Date()

    await db.transaction(async (tx) => {
      await tx
        .update(authAccounts)
        .set({ passwordHash: newHash })
        .where(eq(authAccounts.id, localAccount.id))
      await tx
        .update(users)
        .set({
          failedLoginAttempts: 0,
          lockedUntil: null,
          mustChangePassword: true,
          passwordChangedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, target.id))
    })

    await recordPasswordHistory(target.id, newHash)

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user',
      action: 'admin_password_reset',
      resourceId: target.id,
      meta: { mode: 'auto', targetEmail: target.email },
    })

    return {
      success: true,
      mode: 'auto' as const,
      tempPassword,
      mustChangePassword: true,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in admin password reset', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
