import { consola } from 'consola'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }

    const sessionUser = session.user as { id: string }
    const [localAccount] = await findAuthAccountByUserIdAndProvider(sessionUser.id, 'local')

    return {
      mfaEnabled: localAccount?.mfaEnabled ?? false,
      hasLocalAccount: !!localAccount,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in mfa/status', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
