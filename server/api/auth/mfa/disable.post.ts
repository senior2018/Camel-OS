import { z } from 'zod'
import { consola } from 'consola'
import { OTP } from 'otplib'
import { eq } from 'drizzle-orm'

import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { useDrizzle } from '@@/server/utils/drizzle'
import { authAccounts, mfaRecoveryCodes } from '@@/server/database/schema'
import { decrypt } from '@@/server/utils/crypto'
import { logAuditEvent } from '@@/server/utils/audit'

const otp = new OTP()

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const sessionUser = session.user as { id: string }

    const schema = z.object({
      code: z
        .string()
        .length(6, 'TOTP code must be 6 digits')
        .regex(/^\d+$/, 'TOTP code must be numeric'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request payload' })
    }

    const [localAccount] = await findAuthAccountByUserIdAndProvider(sessionUser.id, 'local')
    if (!localAccount?.mfaSecret || !localAccount.mfaEnabled) {
      throw createError({ statusCode: 400, statusMessage: 'MFA is not enabled' })
    }

    const totpSecret = decrypt(localAccount.mfaSecret)
    const result = otp.verifySync({ token: parsed.data.code, secret: totpSecret })

    if (!result.valid) {
      throw createError({ statusCode: 401, statusMessage: 'Invalid TOTP code' })
    }

    const db = useDrizzle()

    await db.transaction(async (tx) => {
      await tx
        .update(authAccounts)
        .set({ mfaEnabled: false, mfaSecret: null })
        .where(eq(authAccounts.id, localAccount.id))

      await tx.delete(mfaRecoveryCodes).where(eq(mfaRecoveryCodes.userId, sessionUser.id))
    })

    await logAuditEvent({
      organizationId: null,
      userId: sessionUser.id,
      resource: 'auth',
      action: 'mfa_disabled',
      meta: {},
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in mfa/disable', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
