import { consola } from 'consola'
import { and, eq, isNull } from 'drizzle-orm'

import { organizations, userInvitations } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { sha256 } from '@@/server/utils/crypto'

/**
 * Validates an invitation token and returns minimal metadata for the accept-invite page
 * to render the form (email, name, organization). Returns 410 for invalid/expired/used.
 *
 * Public endpoint — no session required.
 */
export default defineEventHandler(async (event) => {
  try {
    const token = getRouterParam(event, 'token')
    if (!token || token.length < 8) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid token' })
    }

    const tokenHash = sha256(token)
    const db = useDrizzle()

    const [invitation] = await db
      .select({
        id: userInvitations.id,
        email: userInvitations.email,
        firstName: userInvitations.firstName,
        lastName: userInvitations.lastName,
        expiresAt: userInvitations.expiresAt,
        acceptedAt: userInvitations.acceptedAt,
        revokedAt: userInvitations.revokedAt,
        organizationName: organizations.name,
      })
      .from(userInvitations)
      .innerJoin(organizations, eq(organizations.id, userInvitations.organizationId))
      .where(
        and(
          eq(userInvitations.tokenHash, tokenHash),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt)
        )
      )
      .limit(1)

    if (!invitation || invitation.expiresAt < new Date()) {
      throw createError({
        statusCode: 410,
        statusMessage: 'This invitation is invalid, expired, or has already been used.',
      })
    }

    return {
      email: invitation.email,
      firstName: invitation.firstName,
      lastName: invitation.lastName,
      organizationName: invitation.organizationName,
      expiresAt: invitation.expiresAt,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error previewing invitation', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
