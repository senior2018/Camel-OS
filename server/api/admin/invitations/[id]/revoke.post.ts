import { consola } from 'consola'
import { and, eq, isNull } from 'drizzle-orm'

import { userInvitations } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const inviteId = getRouterParam(event, 'id')
    if (!inviteId) {
      throw createError({ statusCode: 400, statusMessage: 'Invitation id is required' })
    }

    const db = useDrizzle()
    const now = new Date()

    const [updated] = await db
      .update(userInvitations)
      .set({ revokedAt: now })
      .where(
        and(
          eq(userInvitations.id, inviteId),
          eq(userInvitations.organizationId, admin.organizationId),
          isNull(userInvitations.acceptedAt),
          isNull(userInvitations.revokedAt)
        )
      )
      .returning({ id: userInvitations.id, email: userInvitations.email })

    if (!updated) {
      throw createError({
        statusCode: 404,
        statusMessage: 'Invitation not found or already finalized',
      })
    }

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user_invitation',
      action: 'invite_revoked',
      resourceId: inviteId,
      meta: { email: updated.email, by: admin.email },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error revoking invitation', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
