import { consola } from 'consola'
import { and, eq, isNull } from 'drizzle-orm'

import {
  authAccounts,
  organizationMembers,
  userInvitations,
  userRoles,
  userSessions,
  users,
} from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { findUserByEmail } from '@@/server/utils/user'
import { sha256 } from '@@/server/utils/crypto'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { logAuditEvent } from '@@/server/utils/audit'
import { getPasswordPolicy, recordPasswordHistory } from '@@/server/utils/password-policy'
import { userRequiresMfa } from '@@/server/utils/role'
import { validatePasswordAgainstPolicy } from '@@/shared/schemas/password-policy'
import { acceptInvitationSchema } from '@@/shared/schemas/auth'

const SESSION_MS = 7 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  try {
    const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
    const rl = await checkRateLimit(`rl:accept-invite:${ip}`, RATE_LIMITS.acceptInvite)
    if (!rl.allowed) {
      setResponseHeader(event, 'Retry-After', rl.retryAfter)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many attempts. Please try again later.',
      })
    }

    const parsed = acceptInvitationSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request payload' })
    }

    const tokenHash = sha256(parsed.data.token)
    const db = useDrizzle()
    const now = new Date()

    const [invitation] = await db
      .select()
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.tokenHash, tokenHash),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt)
        )
      )
      .limit(1)

    if (!invitation || invitation.expiresAt < now) {
      throw createError({
        statusCode: 410,
        statusMessage: 'This invitation is invalid, expired, or has already been used.',
      })
    }

    // Defensive: if somehow a user with this email exists already, fail cleanly.
    const [existingUser] = await findUserByEmail(invitation.email)
    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'An account with this email already exists. Please sign in instead.',
      })
    }

    // Enforce the org's password policy. New users have no history, so we only
    // need the rule checks here; history is recorded after creation.
    const policy = await getPasswordPolicy(invitation.organizationId)
    const policyErrors = validatePasswordAgainstPolicy(parsed.data.password, policy)
    if (policyErrors.length > 0) {
      throw createError({ statusCode: 400, statusMessage: policyErrors[0] })
    }

    const passwordHash = await hashPassword(parsed.data.password)

    const created = await db.transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          organizationId: invitation.organizationId,
          email: invitation.email,
          firstName: invitation.firstName,
          lastName: invitation.lastName,
          status: 'active',
          role: 'member',
          emailVerifiedAt: now,
          passwordChangedAt: now,
        })
        .returning()
      if (!createdUser) throw new Error('Failed to create user')

      await tx.insert(organizationMembers).values({
        organizationId: invitation.organizationId,
        userId: createdUser.id,
        role: 'member',
      })

      await tx.insert(authAccounts).values({
        userId: createdUser.id,
        provider: 'local',
        passwordHash,
      })

      if (invitation.roleId) {
        await tx.insert(userRoles).values({
          userId: createdUser.id,
          roleId: invitation.roleId,
          assignedByUserId: invitation.invitedByUserId ?? null,
        })
      }

      await tx
        .update(userInvitations)
        .set({ acceptedAt: now })
        .where(eq(userInvitations.id, invitation.id))

      return createdUser
    })

    await recordPasswordHistory(created.id, passwordHash)

    // If the invited role (or any role assigned during onboarding) requires MFA,
    // gate the session so the middleware funnels the new user into /mfa-setup.
    const mustSetupMfa = await userRequiresMfa(created.id)

    await db.insert(userSessions).values({
      userId: created.id,
      organizationId: created.organizationId,
      userAgent: getHeader(event, 'user-agent') ?? null,
      ipAddress: ip,
      expiresAt: new Date(now.getTime() + SESSION_MS),
    })

    await clearUserSession(event)
    await setUserSession(event, {
      user: {
        id: created.id,
        email: created.email,
        firstName: created.firstName,
        lastName: created.lastName,
        avatarUrl: created.avatarUrl,
        mustSetupMfa,
        lastActivityAt: now.getTime(),
      },
    })

    await logAuditEvent({
      organizationId: invitation.organizationId,
      userId: created.id,
      resource: 'user_invitation',
      action: 'invite_accepted',
      resourceId: invitation.id,
      meta: { ip, email: invitation.email },
    })

    return {
      success: true,
      user: {
        id: created.id,
        email: created.email,
        firstName: created.firstName,
        lastName: created.lastName,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error accepting invitation', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
