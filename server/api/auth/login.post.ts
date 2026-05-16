import { z } from 'zod'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'
import { randomBytes } from 'node:crypto'

import { users, userSessions, passwordResetTokens } from '@@/server/database/schema'
import { findUserByEmail } from '@@/server/utils/user'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { useDrizzle } from '@@/server/utils/drizzle'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { logAuditEvent } from '@@/server/utils/audit'
import { encrypt, sha256 } from '@@/server/utils/crypto'
import { sendPasswordResetEmail } from '@@/server/utils/mailer'

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_MS = 24 * 60 * 60 * 1000 // 24 hours — cleared by password reset
const RESET_TTL_MS = 24 * 60 * 60 * 1000
const SESSION_MS = 7 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  try {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const rl = await checkRateLimit(`rl:login:${ip}`, RATE_LIMITS.login)

    if (!rl.allowed) {
      setResponseHeader(event, 'Retry-After', rl.retryAfter)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many login attempts. Please try again later.',
      })
    }

    const schema = z.object({
      email: z.string().trim().email('Email is required'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid login payload' })
    }

    const [existingUser] = await findUserByEmail(parsed.data.email)

    if (!existingUser) {
      throw createError({ statusCode: 401, statusMessage: 'Please check your email or password' })
    }

    // Already locked — tell the user to reset via email
    const now = new Date()
    if (existingUser.lockedUntil && existingUser.lockedUntil > now) {
      await logAuditEvent({
        organizationId: existingUser.organizationId,
        userId: existingUser.id,
        resource: 'auth',
        action: 'login_blocked',
        meta: { ip, reason: 'account_locked' },
      })
      throw createError({
        statusCode: 423,
        statusMessage: 'Account locked. Please reset your password using the link we sent to your email.',
      })
    }

    const [existingAuthAccount] = await findAuthAccountByUserIdAndProvider(existingUser.id, 'local')

    if (!existingAuthAccount?.passwordHash) {
      throw createError({ statusCode: 401, statusMessage: 'Please check your email or password' })
    }

    const isPasswordValid = await verifyPassword(
      existingAuthAccount.passwordHash,
      parsed.data.password
    )

    const db = useDrizzle()

    if (!isPasswordValid) {
      const newAttempts = (existingUser.failedLoginAttempts ?? 0) + 1
      const shouldLock = newAttempts >= MAX_FAILED_ATTEMPTS

      await db
        .update(users)
        .set({
          failedLoginAttempts: newAttempts,
          ...(shouldLock ? { lockedUntil: new Date(now.getTime() + LOCKOUT_MS) } : {}),
        })
        .where(eq(users.id, existingUser.id))

      await logAuditEvent({
        organizationId: existingUser.organizationId,
        userId: existingUser.id,
        resource: 'auth',
        action: 'login_failed',
        meta: { ip, reason: 'invalid_credentials', attempt: newAttempts, locked: shouldLock },
      })

      if (shouldLock) {
        await logAuditEvent({
          organizationId: existingUser.organizationId,
          userId: existingUser.id,
          resource: 'auth',
          action: 'account_locked',
          meta: { ip, attempts: newAttempts },
        })

        // Send password reset email so the user can unlock immediately
        try {
          const rawToken = randomBytes(32).toString('hex')
          const tokenHash = sha256(rawToken)
          await db.insert(passwordResetTokens).values({
            userId: existingUser.id,
            tokenHash,
            expiresAt: new Date(now.getTime() + RESET_TTL_MS),
          })
          const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
          await sendPasswordResetEmail(existingUser.email, `${appUrl}/reset-password?token=${rawToken}`)
        } catch (emailErr) {
          consola.error('Failed to send lockout reset email', emailErr)
        }

        throw createError({
          statusCode: 423,
          statusMessage: 'Account locked. We\'ve sent a password reset link to your email.',
        })
      }

      throw createError({ statusCode: 401, statusMessage: 'Please check your email or password' })
    }

    // Successful login — reset lockout counters
    await db
      .update(users)
      .set({ failedLoginAttempts: 0, lockedUntil: null })
      .where(eq(users.id, existingUser.id))

    // If MFA is enabled, issue a short-lived challenge token instead of a full session
    if (existingAuthAccount.mfaEnabled) {
      const challengePayload = JSON.stringify({
        userId: existingUser.id,
        expiresAt: now.getTime() + 10 * 60 * 1000, // 10 minutes
      })
      const mfaChallengeToken = encrypt(challengePayload)

      await logAuditEvent({
        organizationId: existingUser.organizationId,
        userId: existingUser.id,
        resource: 'auth',
        action: 'mfa_challenge_issued',
        meta: { ip },
      })

      return { mfaRequired: true, mfaChallengeToken }
    }

    // Track session in DB
    await db.insert(userSessions).values({
      userId: existingUser.id,
      organizationId: existingUser.organizationId,
      userAgent: getHeader(event, 'user-agent') ?? null,
      ipAddress: ip,
      expiresAt: new Date(now.getTime() + SESSION_MS),
    })

    await clearUserSession(event)
    await setUserSession(event, {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        avatarUrl: existingUser.avatarUrl,
      },
    })

    await logAuditEvent({
      organizationId: existingUser.organizationId,
      userId: existingUser.id,
      resource: 'auth',
      action: 'login',
      resourceId: existingUser.id,
      meta: { ip, provider: 'local' },
    })

    return {
      success: true,
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
    consola.error('Error logging in user', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
