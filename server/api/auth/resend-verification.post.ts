import { randomBytes } from 'node:crypto'
import { consola } from 'consola'

import { emailVerificationTokens } from '@@/server/database/schema'
import { findUserById } from '@@/server/utils/user'
import { useDrizzle } from '@@/server/utils/drizzle'
import { sha256 } from '@@/server/utils/crypto'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { logAuditEvent } from '@@/server/utils/audit'
import { sendEmailVerificationEmail } from '@@/server/utils/mailer'

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000 // 24 hours

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)

    if (!session.user) {
      throw createError({ statusCode: 401, statusMessage: 'Not authenticated' })
    }

    const sessionUser = session.user as { id: string }
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const rl = await checkRateLimit(
      `rl:resend-verify:${sessionUser.id}`,
      RATE_LIMITS.resendVerification
    )

    if (!rl.allowed) {
      setResponseHeader(event, 'Retry-After', rl.retryAfter)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many requests. Please try again later.',
      })
    }

    const [user] = await findUserById(sessionUser.id)

    if (!user) {
      throw createError({ statusCode: 404, statusMessage: 'User not found' })
    }

    if (user.status !== 'pending_verification') {
      throw createError({ statusCode: 400, statusMessage: 'Email is already verified' })
    }

    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = sha256(rawToken)
    const expiresAt = new Date(Date.now() + VERIFY_TTL_MS)

    await useDrizzle().insert(emailVerificationTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
    const verifyUrl = `${appUrl}/verify-email?token=${rawToken}`

    await sendEmailVerificationEmail(user.email, verifyUrl)

    await logAuditEvent({
      organizationId: user.organizationId,
      userId: user.id,
      resource: 'auth',
      action: 'verification_email_sent',
      meta: { ip },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in resend-verification', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
