import { z } from 'zod'
import { consola } from 'consola'
import { OTP } from 'otplib'
import { and, eq } from 'drizzle-orm'

import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { useDrizzle } from '@@/server/utils/drizzle'
import { mfaRecoveryCodes, userSessions, users } from '@@/server/database/schema'
import { decrypt, sha256 } from '@@/server/utils/crypto'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { logAuditEvent } from '@@/server/utils/audit'
import { verifyEmailCode } from '@@/server/utils/mfa-email'

const otp = new OTP()
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  try {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const rl = await checkRateLimit(`rl:mfa:${ip}`, RATE_LIMITS.mfaChallenge)

    if (!rl.allowed) {
      setResponseHeader(event, 'Retry-After', rl.retryAfter)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many attempts. Please try again later.',
      })
    }

    const schema = z.object({
      mfaChallengeToken: z.string().min(1, 'Challenge token is required'),
      code: z.string().min(1, 'Code is required'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request payload' })
    }

    // Decrypt and validate the challenge token
    let challengePayload: { userId: string; expiresAt: number }
    try {
      challengePayload = JSON.parse(decrypt(parsed.data.mfaChallengeToken))
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid challenge token' })
    }

    if (Date.now() > challengePayload.expiresAt) {
      throw createError({
        statusCode: 400,
        statusMessage: 'MFA challenge has expired. Please log in again.',
      })
    }

    const { userId } = challengePayload

    const [localAccount] = await findAuthAccountByUserIdAndProvider(userId, 'local')
    if (!localAccount || !localAccount.mfaEnabled) {
      throw createError({ statusCode: 400, statusMessage: 'MFA not configured for this account' })
    }
    if (localAccount.mfaMethod === 'totp' && !localAccount.mfaSecret) {
      throw createError({ statusCode: 400, statusMessage: 'TOTP secret missing — reconfigure MFA' })
    }

    const db = useDrizzle()
    const now = new Date()
    const code = parsed.data.code
    const method = localAccount.mfaMethod

    // Recovery codes work regardless of the chosen primary method — they're a
    // dash-separated 18-hex-char fallback, so they're easy to distinguish from
    // the 6-digit primary codes.
    const isRecoveryCode = code.length > 6

    let resolvedMethod: 'totp' | 'email' | 'recovery_code' = method as 'totp' | 'email'

    if (isRecoveryCode) {
      resolvedMethod = 'recovery_code'
      const normalizedCode = code.replace(/-/g, '').toUpperCase()
      const codeHash = sha256(normalizedCode)

      const [recoveryCode] = await db
        .select()
        .from(mfaRecoveryCodes)
        .where(and(eq(mfaRecoveryCodes.userId, userId), eq(mfaRecoveryCodes.codeHash, codeHash)))
        .limit(1)

      if (!recoveryCode || recoveryCode.usedAt !== null) {
        await logAuditEvent({
          organizationId: null,
          userId,
          resource: 'auth',
          action: 'mfa_challenge_failed',
          meta: { ip, reason: 'invalid_recovery_code' },
        })
        throw createError({
          statusCode: 401,
          statusMessage: 'Invalid or already used recovery code',
        })
      }

      await db
        .update(mfaRecoveryCodes)
        .set({ usedAt: now })
        .where(eq(mfaRecoveryCodes.id, recoveryCode.id))
    } else if (method === 'email') {
      const result = await verifyEmailCode(userId, code)
      if (!result.ok) {
        await logAuditEvent({
          organizationId: null,
          userId,
          resource: 'auth',
          action: 'mfa_challenge_failed',
          meta: { ip, reason: `invalid_email_${result.reason ?? 'invalid'}` },
        })
        throw createError({
          statusCode: 401,
          statusMessage:
            result.reason === 'expired'
              ? 'Code expired. Request a new one.'
              : result.reason === 'exhausted'
                ? 'Too many attempts. Request a new code.'
                : 'Invalid code',
        })
      }
    } else {
      // TOTP — default branch.
      const totpSecret = decrypt(localAccount.mfaSecret!)
      const result = otp.verifySync({ token: code, secret: totpSecret })
      if (!result.valid) {
        await logAuditEvent({
          organizationId: null,
          userId,
          resource: 'auth',
          action: 'mfa_challenge_failed',
          meta: { ip, reason: 'invalid_totp' },
        })
        throw createError({ statusCode: 401, statusMessage: 'Invalid TOTP code' })
      }
    }

    const [existingUser] = await db.select().from(users).where(eq(users.id, userId)).limit(1)

    if (!existingUser) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    await db.insert(userSessions).values({
      userId: existingUser.id,
      organizationId: existingUser.organizationId,
      userAgent: getHeader(event, 'user-agent') ?? null,
      ipAddress: ip,
      expiresAt: new Date(now.getTime() + SESSION_MS),
    })

    // Carry any password-expiry flag set by the login step into the MFA-completed
    // session. `mustSetupMfa` is necessarily false here — they just used a TOTP.
    const mustChangePassword = existingUser.mustChangePassword === true

    await clearUserSession(event)
    await setUserSession(event, {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        avatarUrl: existingUser.avatarUrl,
        mustChangePassword,
        mustSetupMfa: false,
        lastActivityAt: now.getTime(),
      },
    })

    await logAuditEvent({
      organizationId: existingUser.organizationId,
      userId: existingUser.id,
      resource: 'auth',
      action: 'mfa_challenge_passed',
      meta: { ip, method: resolvedMethod },
    })

    return {
      success: true,
      mustChangePassword,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        avatarUrl: existingUser.avatarUrl,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in mfa/challenge', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
