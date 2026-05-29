import { consola } from 'consola'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { useDrizzle } from '@@/server/utils/drizzle'
import { authAccounts } from '@@/server/database/schema'
import { logAuditEvent } from '@@/server/utils/audit'
import { dispatchEmailCode } from '@@/server/utils/mfa-email'

/**
 * S5b — picks the MFA method during initial setup.
 *
 * - `totp`: just records the choice; the existing /setup endpoint already
 *   generates the QR + secret. Default for compatibility with existing flow.
 * - `email`: records the choice AND dispatches a one-time code to the user's
 *   email so they can verify ownership before MFA is enabled. The user then
 *   confirms via the existing /verify-setup endpoint (which we'll teach to
 *   accept an email code when `mfaMethod = email`).
 */
const schema = z.object({
  method: z.enum(['totp', 'email']),
})

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session.user) throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })

    const sessionUser = session.user as { id: string }
    const parsed = schema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid method',
      })
    }

    const [localAccount] = await findAuthAccountByUserIdAndProvider(sessionUser.id, 'local')
    if (!localAccount) {
      throw createError({ statusCode: 400, statusMessage: 'No local account' })
    }
    if (localAccount.mfaEnabled) {
      throw createError({ statusCode: 409, statusMessage: 'MFA already enabled' })
    }

    await useDrizzle()
      .update(authAccounts)
      .set({ mfaMethod: parsed.data.method })
      .where(eq(authAccounts.id, localAccount.id))

    if (parsed.data.method === 'email') {
      await dispatchEmailCode(sessionUser.id)
    }

    await logAuditEvent({
      organizationId: null,
      userId: sessionUser.id,
      resource: 'auth',
      action: 'mfa_method_selected',
      meta: { method: parsed.data.method },
    })

    return { success: true, method: parsed.data.method }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in mfa/select-method', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
