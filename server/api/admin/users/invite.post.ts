import { consola } from 'consola'
import { randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'

import { organizations, userInvitations } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { findUserByEmail } from '@@/server/utils/user'
import { sha256 } from '@@/server/utils/crypto'
import { sendInvitationEmail } from '@@/server/utils/mailer'
import { logAuditEvent } from '@@/server/utils/audit'
import { checkRateLimit, RATE_LIMITS } from '@@/server/utils/rate-limit'
import { inviteUserSchema } from '@@/shared/schemas/admin'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)

    // Per-admin invite rate limit (anti-spam)
    const rl = await checkRateLimit(`rl:admin-invite:${admin.userId}`, RATE_LIMITS.adminInvite)
    if (!rl.allowed) {
      setResponseHeader(event, 'Retry-After', rl.retryAfter)
      throw createError({
        statusCode: 429,
        statusMessage: 'Too many invitations sent. Please try again later.',
      })
    }

    const parsed = inviteUserSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid invitation payload' })
    }

    const { email, firstName, lastName, roleId } = parsed.data
    const db = useDrizzle()

    // Reject if a user with this email already exists anywhere (email is globally unique).
    const [existingUser] = await findUserByEmail(email)
    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'A user with this email already exists',
      })
    }

    // Reject if there's already an outstanding (unaccepted, unrevoked, non-expired) invite for this email.
    const now = new Date()
    const [openInvite] = await db
      .select({ id: userInvitations.id, expiresAt: userInvitations.expiresAt })
      .from(userInvitations)
      .where(
        and(
          eq(userInvitations.organizationId, admin.organizationId),
          eq(userInvitations.email, email),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt)
        )
      )
      .limit(1)

    if (openInvite && openInvite.expiresAt > now) {
      throw createError({
        statusCode: 409,
        statusMessage: 'An invitation has already been sent to this address',
      })
    }

    // Load org name for the email body
    const [org] = await db
      .select({ name: organizations.name })
      .from(organizations)
      .where(eq(organizations.id, admin.organizationId))
      .limit(1)
    if (!org) throw createError({ statusCode: 500, statusMessage: 'Organization not found' })

    // Generate raw token (sent in email) — store only sha256(token).
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = sha256(rawToken)
    const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS)

    const [invitation] = await db
      .insert(userInvitations)
      .values({
        organizationId: admin.organizationId,
        email,
        firstName,
        lastName,
        roleId: roleId ?? null,
        invitedByUserId: admin.userId,
        tokenHash,
        expiresAt,
      })
      .returning()

    if (!invitation) throw new Error('Failed to create invitation')

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user_invitation',
      action: 'invite_sent',
      resourceId: invitation.id,
      meta: { email, invitedByEmail: admin.email },
    })

    // Best-effort email — don't fail the request if the email service is unavailable.
    try {
      const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
      await sendInvitationEmail(email, {
        inviteeName: firstName,
        inviterName: admin.email,
        organizationName: org.name,
        acceptUrl: `${appUrl}/accept-invite?token=${rawToken}`,
      })
    } catch (emailErr) {
      consola.error('Failed to send invitation email', emailErr)
    }

    return {
      success: true,
      invitation: {
        id: invitation.id,
        email,
        firstName,
        lastName,
        expiresAt: invitation.expiresAt,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error inviting user', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
