import { consola } from 'consola'

import type { User } from '@@/server/database/schema'
import {
  createGoogleAuthAccount,
  findAuthAccountByProviderAndProviderUserId,
} from '@@/server/utils/auth-account'
import { createDefaultWorkspaceForUser } from '@@/server/utils/workspace'
import { createUserAccount, findUserByEmail, findUserById } from '@@/server/utils/user'

export default defineOAuthGoogleEventHandler({
  config: {
    scope: ['email', 'profile'],
  },
  async onSuccess(event, { user }) {
    try {
      const googleId = String((user as { sub?: string }).sub || '').trim()
      const email = String((user as { email?: string }).email || '')
        .trim()
        .toLowerCase()
      const emailVerified = (user as { email_verified?: boolean }).email_verified
      const avatarUrl =
        typeof (user as { picture?: string }).picture === 'string'
          ? (user as { picture: string }).picture
          : null

      const name = String((user as { name?: string }).name || '').trim()
      const firstName = (user as { given_name?: string }).given_name || name.split(' ')[0] || 'User'
      const lastName =
        (user as { family_name?: string }).family_name ||
        name.split(' ').slice(1).join(' ') ||
        'Account'

      if (!googleId || !email) {
        throw createError({
          statusCode: 400,
          statusMessage: 'Google account information is incomplete',
        })
      }

      if (emailVerified === false) {
        throw createError({
          statusCode: 403,
          statusMessage: 'Email not verified by Google',
        })
      }

      let appUser: User | null = null

      const [existingGoogleAccount] = await findAuthAccountByProviderAndProviderUserId(
        'google',
        googleId
      )

      if (existingGoogleAccount) {
        const [existingUser] = await findUserById(existingGoogleAccount.userId)

        if (!existingUser) {
          throw createError({
            statusCode: 500,
            statusMessage: 'Linked Google account is missing a user record',
          })
        }

        appUser = existingUser
      } else {
        const [existingEmailUser] = await findUserByEmail(email)

        if (existingEmailUser) {
          throw createError({
            statusCode: 409,
            statusMessage:
              'An account already exists for this email. Please sign in with email instead.',
          })
        }

        appUser = await createUserAccount({
          email,
          firstName,
          lastName,
          avatarUrl,
        })

        if (!appUser) {
          throw createError({
            statusCode: 500,
            statusMessage: 'Failed to create user account',
          })
        }

        const createdGoogleAccount = await createGoogleAuthAccount({
          userId: appUser.id,
          providerUserId: googleId,
        })

        if (!createdGoogleAccount) {
          throw createError({
            statusCode: 500,
            statusMessage: 'Failed to create Google auth account',
          })
        }

        await createDefaultWorkspaceForUser({
          id: appUser.id,
          firstName: appUser.firstName,
          lastName: appUser.lastName,
        })
      }

      await clearUserSession(event)
      await setUserSession(event, {
        user: {
          id: appUser.id,
          email: appUser.email,
          firstName: appUser.firstName,
          lastName: appUser.lastName,
          avatarUrl: appUser.avatarUrl,
        },
      })

      return sendRedirect(event, '/dashboard')
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'statusCode' in error) {
        throw error
      }

      consola.error('Auth error using Google:', error)
      throw createError({
        statusCode: 500,
        statusMessage: 'Authentication failed',
      })
    }
  },
})
