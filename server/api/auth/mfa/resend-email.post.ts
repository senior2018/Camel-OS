import { consola } from 'consola'
import { z } from 'zod'

import { decrypt } from '@@/server/utils/crypto'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { dispatchEmailCode } from '@@/server/utils/mfa-email'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * Resend the 6-digit MFA email code during the challenge step. Reuses the
 * existing challenge token so the user doesn't have to log in again — we only
 * decrypt it to recover the userId. Rate-limited per IP because it sends mail.
 */
const schema = z.object({
  mfaChallengeToken: z.string().min(1),
})

export default defineEventHandler(async (event) => {
  try {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const rl = await checkRateLimit(`rl:mfa-resend:${ip}`, RATE_LIMITS.mfaChallenge)
    if (!rl.allowed) {
      setResponseHeader(event, 'Retry-After', rl.retryAfter)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many requests. Please wait and try again.',
      })
    }

    const parsed = schema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request' })
    }

    let payload: { userId: string; expiresAt: number }
    try {
      payload = JSON.parse(decrypt(parsed.data.mfaChallengeToken))
    } catch {
      throw createError({ statusCode: 400, statusMessage: 'Invalid challenge token' })
    }

    if (Date.now() > payload.expiresAt) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Challenge expired. Please log in again.',
      })
    }

    const [acct] = await findAuthAccountByUserIdAndProvider(payload.userId, 'local')
    if (!acct?.mfaEnabled || acct.mfaMethod !== 'email') {
      throw createError({ statusCode: 400, statusMessage: 'Email MFA is not configured' })
    }

    await dispatchEmailCode(payload.userId)
    await logAuditEvent({
      organizationId: null,
      userId: payload.userId,
      resource: 'auth',
      action: 'mfa_email_code_resent',
      meta: { ip },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in mfa/resend-email', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
