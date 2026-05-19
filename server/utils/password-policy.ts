import { desc, eq } from 'drizzle-orm'

import { passwordHistory, passwordPolicies } from '../database/schema'
import { useDrizzle } from './drizzle'
import {
  DEFAULT_PASSWORD_POLICY,
  validatePasswordAgainstPolicy,
  type PasswordPolicy,
} from '@@/shared/schemas/password-policy'

/**
 * Returns the policy row for the org, lazily seeding the defaults if none exists.
 * Always returns a fully-populated policy — callers never need to handle `null`.
 */
export async function getPasswordPolicy(organizationId: string): Promise<PasswordPolicy> {
  const db = useDrizzle()

  const [row] = await db
    .select()
    .from(passwordPolicies)
    .where(eq(passwordPolicies.organizationId, organizationId))
    .limit(1)

  if (row) {
    return {
      minLength: row.minLength,
      requireUppercase: row.requireUppercase,
      requireLowercase: row.requireLowercase,
      requireNumber: row.requireNumber,
      requireSymbol: row.requireSymbol,
      expiryDays: row.expiryDays,
      historyCount: row.historyCount,
    }
  }

  // No policy row yet — seed the default once, then return it.
  await db.insert(passwordPolicies).values({
    organizationId,
    ...DEFAULT_PASSWORD_POLICY,
  })
  return DEFAULT_PASSWORD_POLICY
}

/**
 * Checks the user's new password against the org's policy rules AND, when
 * `policy.historyCount > 0`, against the last N stored password hashes. Returns
 * an array of error messages (empty when the password is acceptable).
 *
 * This is the canonical server-side enforcement point — call it from every
 * endpoint that creates or changes a password.
 */
export async function enforcePasswordPolicy(
  userId: string,
  organizationId: string,
  newPassword: string
): Promise<string[]> {
  const policy = await getPasswordPolicy(organizationId)
  const ruleErrors = validatePasswordAgainstPolicy(newPassword, policy)
  if (ruleErrors.length > 0) return ruleErrors

  if (policy.historyCount > 0) {
    const previous = await useDrizzle()
      .select({ passwordHash: passwordHistory.passwordHash })
      .from(passwordHistory)
      .where(eq(passwordHistory.userId, userId))
      .orderBy(desc(passwordHistory.createdAt))
      .limit(policy.historyCount)

    for (const row of previous) {
      if (await verifyPassword(row.passwordHash, newPassword)) {
        return [`Cannot reuse any of your last ${policy.historyCount} password(s)`]
      }
    }
  }

  return []
}

/** Append a password hash to the user's history. Called after every successful change. */
export async function recordPasswordHistory(userId: string, passwordHash: string) {
  await useDrizzle().insert(passwordHistory).values({ userId, passwordHash })
}

/**
 * Returns true when the user's password is older than the org's `expiryDays`
 * setting. A null `expiryDays` or null `passwordChangedAt` means "never expires".
 */
export function isPasswordExpired(
  passwordChangedAt: Date | null,
  policy: Pick<PasswordPolicy, 'expiryDays'>
): boolean {
  if (!policy.expiryDays || !passwordChangedAt) return false
  const expiresAt = new Date(passwordChangedAt.getTime() + policy.expiryDays * 86_400_000)
  return Date.now() > expiresAt.getTime()
}
