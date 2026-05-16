import { z } from 'zod'
import { consola } from 'consola'

import { findUserByEmail } from '@@/server/utils/user'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { logAuditEvent } from '@@/server/utils/audit'

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

    const [existingAuthAccount] = await findAuthAccountByUserIdAndProvider(existingUser.id, 'local')

    if (!existingAuthAccount?.passwordHash) {
      throw createError({ statusCode: 401, statusMessage: 'Please check your email or password' })
    }

    const isPasswordValid = await verifyPassword(
      existingAuthAccount.passwordHash,
      parsed.data.password
    )

    if (!isPasswordValid) {
      await logAuditEvent({
        organizationId: existingUser.organizationId,
        userId: existingUser.id,
        resource: 'auth',
        action: 'login_failed',
        meta: { ip, reason: 'invalid_credentials' },
      })
      throw createError({ statusCode: 401, statusMessage: 'Please check your email or password' })
    }

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
