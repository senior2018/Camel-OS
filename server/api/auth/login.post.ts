import { z } from 'zod'
import { findUserByEmail } from '@@/server/utils/user'
import { findAuthAccountByUserIdAndProvider } from '@@/server/utils/auth-account'
import { consola } from 'consola'

export default defineEventHandler(async (event) => {
  try {
    const schema = z.object({
      email: z.string().trim().email('Email is required'),
      password: z.string().min(6, 'Password must be at least 6 characters'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid login payload',
      })
    }

    const [existingUser] = await findUserByEmail(parsed.data.email)

    if (!existingUser) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Please check your email or password',
      })
    }

    const [existingAuthAccount] = await findAuthAccountByUserIdAndProvider(existingUser.id, 'email')

    if (!existingAuthAccount?.passwordHash) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Please check your email or password',
      })
    }

    const isPasswordValid = await verifyPassword(existingAuthAccount.passwordHash, parsed.data.password)

    if (!isPasswordValid) {
      throw createError({
        statusCode: 401,
        statusMessage: 'Please check your email or password',
      })
    }

    await clearUserSession(event)

    await setUserSession(event, {
      user: {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        avatarUrl: existingUser.avatarUrl,
      },
    })

    return {
      success: true,
      user: {
        id: existingUser.id,
        email: existingUser.email,
        firstName: existingUser.firstName,
        lastName: existingUser.lastName,
        avatarUrl: existingUser.avatarUrl,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      throw error
    }

    consola.error('Error loggin in user', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    })
  }
})
