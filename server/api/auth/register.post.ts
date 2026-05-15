import { z } from 'zod'
import { authAccounts, users } from '@@/server/database/schema'
import { createDefaultWorkspaceForUser } from '@@/server/utils/workspace'
import { findUserByEmail } from '@@/server/utils/user'
import { useDrizzle } from '@@/server/utils/drizzle'
import { consola } from 'consola'

export default defineEventHandler(async (event) => {
  try {
    const schema = z.object({
      email: z.email('Email is required').trim(),
      password: z.string().min(6, 'Password must be at least 6 characters'),
      firstName: z.string().trim().min(1, 'First name is required'),
      lastName: z.string().trim().min(1, 'Last name is required'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid registration payload',
      })
    }

    const [existingUser] = await findUserByEmail(parsed.data.email)

    if (existingUser) {
      throw createError({
        statusCode: 409,
        statusMessage: 'User with this email already exists',
      })
    }

    const passwordHash = await hashPassword(parsed.data.password)

    const insertedUser = await useDrizzle().transaction(async (tx) => {
      const [createdUser] = await tx
        .insert(users)
        .values({
          email: parsed.data.email,
          firstName: parsed.data.firstName,
          lastName: parsed.data.lastName,
          avatarUrl: null,
        })
        .returning()

      if (!createdUser) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to create user',
        })
      }

      const [createdAuthAccount] = await tx
        .insert(authAccounts)
        .values({
          userId: createdUser.id,
          provider: 'email',
          passwordHash,
        })
        .returning()

      if (!createdAuthAccount) {
        throw createError({
          statusCode: 500,
          statusMessage: 'Failed to create auth account',
        })
      }

      return createdUser
    })

    await createDefaultWorkspaceForUser({
      id: insertedUser.id,
      firstName: insertedUser.firstName,
      lastName: insertedUser.lastName,
    })

    await clearUserSession(event)
    await setUserSession(event, {
      user: {
        id: insertedUser.id,
        email: insertedUser.email,
        firstName: insertedUser.firstName,
        lastName: insertedUser.lastName,
        avatarUrl: insertedUser.avatarUrl,
      },
    })

    consola.info(`New user registered: ${insertedUser.email} (ID: ${insertedUser.id})`)

    return {
      success: true,
      user: {
        id: insertedUser.id,
        email: insertedUser.email,
        firstName: insertedUser.firstName,
        lastName: insertedUser.lastName,
        avatarUrl: insertedUser.avatarUrl,
      },
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) {
      throw error
    }

    consola.error('Error registering user', error)
    throw createError({
      statusCode: 500,
      statusMessage: 'Internal server error',
    })
  }
})
