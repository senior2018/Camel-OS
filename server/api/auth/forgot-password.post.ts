import { randomBytes } from 'node:crypto'
import { z } from 'zod'
import { consola } from 'consola'

import { passwordResetTokens } from '@@/server/database/schema'
import { findUserByEmail } from '@@/server/utils/user'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { useDrizzle } from '@@/server/utils/drizzle'
import { sha256 } from '@@/server/utils/crypto'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { logAuditEvent } from '@@/server/utils/audit'
import { sendPasswordResetEmail } from '@@/server/utils/mailer'

const RESET_TTL_MS = 60 * 60 * 1000 // 1 hour

export default defineEventHandler(async (event) => {
  try {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const rl = await checkRateLimit(`rl:forgot:${ip}`, RATE_LIMITS.forgotPassword)

    if (!rl.allowed) {
      setResponseHeader(event, 'Retry-After', rl.retryAfter)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many requests. Please try again later.',
      })
    }

    const schema = z.object({
      email: z.string().trim().email('Valid email required'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request payload' })
    }

    // Always return 200 — never reveal whether email exists
    const silentOk = { success: true }

    const [user] = await findUserByEmail(parsed.data.email)
    if (!user) return silentOk

    const [localAccount] = await findAuthAccountByUserIdAndProvider(user.id, 'local')
    if (!localAccount) return silentOk // Google-only account — no password to reset

    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = sha256(rawToken)
    const expiresAt = new Date(Date.now() + RESET_TTL_MS)

    await useDrizzle().insert(passwordResetTokens).values({
      userId: user.id,
      tokenHash,
      expiresAt,
    })

    const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
    const resetUrl = `${appUrl}/reset-password?token=${rawToken}`

    await sendPasswordResetEmail(user.email, resetUrl)

    await logAuditEvent({
      organizationId: user.organizationId,
      userId: user.id,
      resource: 'auth',
      action: 'password_reset_requested',
      meta: { ip },
    })

    return silentOk
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in forgot-password', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
