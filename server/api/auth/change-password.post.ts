import { consola } from 'consola'
import { eq } from 'drizzle-orm'

import { authAccounts, users } from '@@/server/database/schema'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { findUserById } from '@@/server/utils/user'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { enforcePasswordPolicy, recordPasswordHistory } from '@@/server/utils/password-policy'
import { changePasswordRequestSchema } from '@@/shared/schemas/change-password'

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const sessionUser = session.user as { id: string }

    const parsed = changePasswordRequestSchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request payload' })
    }

    const [user] = await findUserById(sessionUser.id)
    if (!user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const [localAccount] = await findAuthAccountByUserIdAndProvider(user.id, 'local')
    if (!localAccount?.passwordHash) {
      throw createError({
        statusCode: 400,
        statusMessage: 'This account does not use a password.',
      })
    }

    const currentValid = await verifyPassword(
      localAccount.passwordHash,
      parsed.data.currentPassword
    )
    if (!currentValid) {
      throw createError({ statusCode: 401, statusMessage: 'Current password is incorrect' })
    }

    const policyErrors = await enforcePasswordPolicy(
      user.id,
      user.organizationId,
      parsed.data.newPassword
    )
    if (policyErrors.length > 0) {
      throw createError({ statusCode: 400, statusMessage: policyErrors[0] })
    }

    const newPasswordHash = await hashPassword(parsed.data.newPassword)
    const now = new Date()
    const db = useDrizzle()

    await db.transaction(async (tx) => {
      await tx
        .update(authAccounts)
        .set({ passwordHash: newPasswordHash })
        .where(eq(authAccounts.id, localAccount.id))

      await tx
        .update(users)
        .set({
          mustChangePassword: false,
          passwordChangedAt: now,
          updatedAt: now,
        })
        .where(eq(users.id, user.id))
    })

    await recordPasswordHistory(user.id, newPasswordHash)

    // The session cookie still carries the `mustChangePassword: true` flag that
    // was baked in at login time, so the auth middleware would bounce the user
    // straight back to /change-password if we don't update it. `setUserSession`
    // merges into the existing session so we only need to flip the one field.
    await setUserSession(event, {
      user: {
        ...session.user,
        mustChangePassword: false,
      },
    })

    await logAuditEvent({
      organizationId: user.organizationId,
      userId: user.id,
      resource: 'auth',
      action: 'password_changed',
      meta: { ip: getRequestIP(event, { xForwardedFor: true }) ?? 'unknown' },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error changing password', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
