import { consola } from 'consola'
import qrcode from 'qrcode'
import { OTP } from 'otplib'

import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { useDrizzle } from '@@/server/utils/drizzle'
import { authAccounts } from '@@/server/database/schema'
import { encrypt } from '@@/server/utils/crypto'
import { eq } from 'drizzle-orm'
import { logAuditEvent } from '@@/server/utils/audit'

const otp = new OTP()

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const sessionUser = session.user as { id: string; email: string }

    const [localAccount] = await findAuthAccountByUserIdAndProvider(sessionUser.id, 'local')
    if (!localAccount) {
      throw createError({ statusCode: 400, statusMessage: 'MFA is only available for local accounts' })
    }

    if (localAccount.mfaEnabled) {
      throw createError({ statusCode: 409, statusMessage: 'MFA is already enabled' })
    }

    const secret = otp.generateSecret()
    const encryptedSecret = encrypt(secret)

    await useDrizzle()
      .update(authAccounts)
      .set({ mfaSecret: encryptedSecret })
      .where(eq(authAccounts.id, localAccount.id))

    const otpauthUrl = otp.generateURI({ issuer: 'Camel OS', label: sessionUser.email, secret })
    const qrDataUrl = await qrcode.toDataURL(otpauthUrl)

    await logAuditEvent({
      organizationId: null,
      userId: sessionUser.id,
      resource: 'auth',
      action: 'mfa_setup_initiated',
      meta: {},
    })

    return { qrDataUrl, secret, otpauthUrl }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in mfa/setup', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
