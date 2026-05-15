import { eq } from 'drizzle-orm'

import { users } from '../database/schema'
import { useDrizzle } from './drizzle'

export type NewUserAccount = {
  email: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
}

export function findUserByEmail(email: string) {
  const normalizedEmail = email.trim().toLowerCase()

  return useDrizzle().select().from(users).where(eq(users.email, normalizedEmail)).limit(1)
}

export function findUserById(id: string) {
  return useDrizzle().select().from(users).where(eq(users.id, id)).limit(1)
}

export async function createUserAccount(user: NewUserAccount) {
  const normalizedEmail = user.email.trim().toLowerCase()

  const [insertedUser] = await useDrizzle()
    .insert(users)
    .values({
      email: normalizedEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null
    })
    .returning()

  return insertedUser
}
