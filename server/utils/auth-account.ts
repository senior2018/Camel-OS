import { and, eq } from 'drizzle-orm'

import { authAccounts } from '../database/schema'
import { useDrizzle } from './drizzle'

export type NewLocalAuthAccount = {
  userId: string
  passwordHash: string
}

export function findAuthAccountByUserIdAndProvider(
  userId: string,
  provider: 'local' | 'google' | 'microsoft'
) {
  return useDrizzle()
    .select()
    .from(authAccounts)
    .where(and(eq(authAccounts.userId, userId), eq(authAccounts.provider, provider)))
    .limit(1)
}

export function findAuthAccountByProviderAndProviderUserId(
  provider: 'local' | 'google' | 'microsoft',
  providerUserId: string
) {
  return useDrizzle()
    .select()
    .from(authAccounts)
    .where(
      and(eq(authAccounts.provider, provider), eq(authAccounts.providerUserId, providerUserId))
    )
    .limit(1)
}

export async function createLocalAuthAccount(authAccount: NewLocalAuthAccount) {
  const [insertedAuthAccount] = await useDrizzle()
    .insert(authAccounts)
    .values({
      userId: authAccount.userId,
      provider: 'local',
      passwordHash: authAccount.passwordHash,
    })
    .returning()

  return insertedAuthAccount
}

export async function createGoogleAuthAccount(authAccount: {
  userId: string
  providerUserId: string
}) {
  const [insertedAuthAccount] = await useDrizzle()
    .insert(authAccounts)
    .values({
      userId: authAccount.userId,
      provider: 'google',
      providerUserId: authAccount.providerUserId,
    })
    .returning()

  return insertedAuthAccount
}
