import { eq } from 'drizzle-orm'

import { users } from '../database/schema'
import { useDrizzle } from './drizzle'

export type NewUserAccount = {
  organizationId: string
  email: string
  firstName: string
  lastName: string
  avatarUrl?: string | null
  role?: 'system_admin' | 'org_admin' | 'member'
  status?: 'active' | 'suspended' | 'pending_verification'
  emailVerifiedAt?: Date | null
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
      organizationId: user.organizationId,
      email: normalizedEmail,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl ?? null,
      role: user.role ?? 'member',
      status: user.status ?? 'pending_verification',
      emailVerifiedAt: user.emailVerifiedAt ?? null,
    })
    .returning()

  return insertedUser
}
