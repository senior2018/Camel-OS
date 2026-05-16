import { z } from 'zod'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'

import { authAccounts, passwordResetTokens, users } from '@@/server/database/schema'
import { findUserById } from '@@/server/utils/user'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { useDrizzle } from '@@/server/utils/drizzle'
import { sha256 } from '@@/server/utils/crypto'
import { logAuditEvent } from '@@/server/utils/audit'

const INVALID_TOKEN_ERROR = createError({
  statusCode: 400,
  statusMessage: 'This reset link is invalid or has expired.',
})

export default defineEventHandler(async (event) => {
  try {
    const schema = z.object({
      token: z.string().min(1, 'Token is required'),
      password: z.string().min(8, 'Password must be at least 8 characters'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request payload' })
    }

    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const db = useDrizzle()
    const tokenHash = sha256(parsed.data.token)

    const [resetToken] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1)

    const now = new Date()

    if (!resetToken || resetToken.usedAt !== null || resetToken.expiresAt < now) {
      throw INVALID_TOKEN_ERROR
    }

    const [user] = await findUserById(resetToken.userId)
    if (!user) throw INVALID_TOKEN_ERROR

    const [localAccount] = await findAuthAccountByUserIdAndProvider(user.id, 'local')
    if (!localAccount) throw INVALID_TOKEN_ERROR

    const newPasswordHash = await hashPassword(parsed.data.password)

    await db.transaction(async (tx) => {
      await tx
        .update(authAccounts)
        .set({ passwordHash: newPasswordHash })
        .where(eq(authAccounts.id, localAccount.id))

      await tx
        .update(passwordResetTokens)
        .set({ usedAt: now })
        .where(eq(passwordResetTokens.id, resetToken.id))

      // Clear any lockout so the user can log in immediately after reset
      await tx
        .update(users)
        .set({ failedLoginAttempts: 0, lockedUntil: null })
        .where(eq(users.id, user.id))
    })

    await clearUserSession(event)

    await logAuditEvent({
      organizationId: user.organizationId,
      userId: user.id,
      resource: 'auth',
      action: 'password_reset',
      meta: { ip },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in reset-password', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
