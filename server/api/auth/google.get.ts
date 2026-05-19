import { consola } from 'consola'

import type { User } from '@@/server/database/schema'
import { authAccounts, organizationMembers, organizations, users } from '@@/server/database/schema'
import { findAuthAccountByProviderAndProviderUserId } from '@@/server/utils/auth-account'
import { findUserByEmail, findUserById } from '@@/server/utils/user'
import { useDrizzle } from '@@/server/utils/drizzle'
import { generateOrgSlug } from '@@/server/utils/workspace'
import { logAuditEvent } from '@@/server/utils/audit'

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
        throw createError({ statusCode: 403, statusMessage: 'Email not verified by Google' })
      }

      const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
      let appUser: User | null = null
      let isNewUser = false

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

        appUser = await useDrizzle().transaction(async (tx) => {
          const orgName = `${firstName} ${lastName}'s Workspace`

          const [org] = await tx
            .insert(organizations)
            .values({ name: orgName, slug: generateOrgSlug(orgName), plan: 'free' })
            .returning()

          if (!org) throw new Error('Failed to create organization')

          const [createdUser] = await tx
            .insert(users)
            .values({
              organizationId: org.id,
              email,
              firstName,
              lastName,
              avatarUrl,
              status: 'active',
              role: 'member',
              emailVerifiedAt: new Date(),
            })
            .returning()

          if (!createdUser) throw new Error('Failed to create user')

          await tx.insert(organizationMembers).values({
            organizationId: org.id,
            userId: createdUser.id,
            role: 'owner',
          })

          await tx.insert(authAccounts).values({
            userId: createdUser.id,
            provider: 'google',
            providerUserId: googleId,
          })

          isNewUser = true
          return createdUser
        })
      }

      if (!appUser) {
        throw createError({ statusCode: 500, statusMessage: 'Authentication failed' })
      }

      await clearUserSession(event)
      await setUserSession(event, {
        user: {
          id: appUser.id,
          email: appUser.email,
          firstName: appUser.firstName,
          lastName: appUser.lastName,
          avatarUrl: appUser.avatarUrl,
          lastActivityAt: Date.now(),
        },
      })

      await logAuditEvent({
        organizationId: appUser.organizationId,
        userId: appUser.id,
        resource: 'auth',
        action: isNewUser ? 'register' : 'login',
        resourceId: appUser.id,
        meta: { ip, provider: 'google' },
      })

      return sendRedirect(event, '/dashboard')
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
      consola.error('Auth error using Google:', error)
      throw createError({ statusCode: 500, statusMessage: 'Authentication failed' })
    }
  },
})
