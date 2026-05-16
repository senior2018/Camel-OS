import { z } from 'zod'
import { consola } from 'consola'

import { authAccounts, organizationMembers, organizations, users } from '@@/server/database/schema'
import { findUserByEmail } from '@@/server/utils/user'
import { useDrizzle } from '@@/server/utils/drizzle'
import { generateOrgSlug } from '@@/server/utils/workspace'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const rl = await checkRateLimit(`rl:register:${ip}`, RATE_LIMITS.register)

    if (!rl.allowed) {
      setResponseHeader(event, 'Retry-After', rl.retryAfter)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many registration attempts. Please try again later.',
      })
    }

    const schema = z.object({
      email: z.email('Valid email required').trim(),
      password: z.string().min(8, 'Password must be at least 8 characters'),
      firstName: z.string().trim().min(1, 'First name is required'),
      lastName: z.string().trim().min(1, 'Last name is required'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid registration payload' })
    }

    const { email, password, firstName, lastName } = parsed.data
    const normalizedEmail = email.trim().toLowerCase()

    const [existingUser] = await findUserByEmail(normalizedEmail)

    if (existingUser) {
      throw createError({ statusCode: 409, statusMessage: 'User with this email already exists' })
    }

    const passwordHash = await hashPassword(password)

    const insertedUser = await useDrizzle().transaction(async (tx) => {
      const orgName = `${firstName} ${lastName}'s Workspace`

      const [org] = await tx
        .insert(organizations)
        .values({ name: orgName, slug: generateOrgSlug(orgName), plan: 'free' })
        .returning()

      if (!org) throw new Error('Failed to create organization')

      const [createdUser] = await tx
        .insert(users)
        .values({
          organizationId: org.id,
          email: normalizedEmail,
          firstName,
          lastName,
          avatarUrl: null,
          status: 'pending_verification',
          role: 'member',
        })
        .returning()

      if (!createdUser) throw new Error('Failed to create user')

      await tx.insert(organizationMembers).values({
        organizationId: org.id,
        userId: createdUser.id,
        role: 'owner',
      })

      await tx.insert(authAccounts).values({
        userId: createdUser.id,
        provider: 'local',
        passwordHash,
      })

      return createdUser
    })

    await clearUserSession(event)
    await setUserSession(event, {
      user: {
        id: insertedUser.id,
        email: insertedUser.email,
        firstName: insertedUser.firstName,
        lastName: insertedUser.lastName,
        avatarUrl: insertedUser.avatarUrl,
      },
    })

    await logAuditEvent({
      organizationId: insertedUser.organizationId,
      userId: insertedUser.id,
      resource: 'auth',
      action: 'register',
      resourceId: insertedUser.id,
      meta: { ip, provider: 'local' },
    })

    consola.info(`New user registered: ${insertedUser.email} (ID: ${insertedUser.id})`)

    return {
      success: true,
      user: {
        id: insertedUser.id,
        email: insertedUser.email,
        firstName: insertedUser.firstName,
        lastName: insertedUser.lastName,
        avatarUrl: insertedUser.avatarUrl,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error registering user', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
