import { consola } from 'consola'
import { randomBytes } from 'node:crypto'
import { and, eq, isNull } from 'drizzle-orm'

import { organizations, userInvitations } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { sha256 } from '@@/server/utils/crypto'
import { sendInvitationEmail } from '@@/server/utils/mailer'
import { logAuditEvent } from '@@/server/utils/audit'

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const inviteId = getRouterParam(event, 'id')
    if (!inviteId) {
      throw createError({ statusCode: 400, statusMessage: 'Invitation id is required' })
    }

    const db = useDrizzle()

    const [invitation] = await db
      .select({
        id: userInvitations.id,
        email: userInvitations.email,
        firstName: userInvitations.firstName,
        organizationName: organizations.name,
      })
      .from(userInvitations)
      .innerJoin(organizations, eq(organizations.id, userInvitations.organizationId))
      .where(
        and(
          eq(userInvitations.id, inviteId),
          eq(userInvitations.organizationId, admin.organizationId),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt)
        )
      )
      .limit(1)

    if (!invitation) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invitation not found or already finalized',
      })
    }

    // Rotate the token so the previously-sent email link is invalidated.
    const rawToken = randomBytes(32).toString('hex')
    const tokenHash = sha256(rawToken)
    const expiresAt = new Date(Date.now() + INVITATION_TTL_MS)

    await db
      .update(userInvitations)
      .set({ tokenHash, expiresAt })
      .where(eq(userInvitations.id, inviteId))

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user_invitation',
      action: 'invite_resent',
      resourceId: inviteId,
      meta: { email: invitation.email, by: admin.email },
    })

    try {
      const appUrl = (useRuntimeConfig().appUrl as string) || 'http://localhost:3000'
      await sendInvitationEmail(invitation.email, {
        inviteeName: invitation.firstName,
        inviterName: admin.email,
        organizationName: invitation.organizationName,
        acceptUrl: `${appUrl}/accept-invite?token=${rawToken}`,
      })
    } catch (emailErr) {
      consola.error('Failed to resend invitation email', emailErr)
    }

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error resending invitation', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
