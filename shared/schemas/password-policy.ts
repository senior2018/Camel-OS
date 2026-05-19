import { z } from 'zod'

/**
 * Admin-editable password policy. One row per organization (PK is `organizationId`).
 * The `null` on `expiryDays` and `historyCount === 0` mean "no rule".
 */
export const passwordPolicySchema = z.object({
  minLength: z.number().int().min(8, 'Minimum length must be at least 8').max(128),
  requireUppercase: z.boolean(),
  requireLowercase: z.boolean(),
  requireNumber: z.boolean(),
  requireSymbol: z.boolean(),
  expiryDays: z.number().int().min(1, 'Expiry must be at least 1 day').max(3650).nullable(),
  historyCount: z.number().int().min(0, 'History count cannot be negative').max(24),
})

export type PasswordPolicy = z.output<typeof passwordPolicySchema>

/**
 * Defaults applied when a workspace has no policy row yet. Matches commonly
 * accepted baseline (NIST 800-63B): ≥8 chars, no required character classes,
 * no expiry, no history check. Admins can tighten this at any time.
 */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSymbol: false,
  expiryDays: null,
  historyCount: 0,
}

/**
 * Pure check used by both the server (defense-in-depth) and the client (inline form
 * feedback). Returns a list of human-readable rule violations; an empty list means
 * the password satisfies the policy.
 */
export function validatePasswordAgainstPolicy(password: string, policy: PasswordPolicy): string[] {
  const errors: string[] = []

  if (password.length < policy.minLength) {
    errors.push(`Must be at least ${policy.minLength} characters`)
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push('Must contain an uppercase letter')
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push('Must contain a lowercase letter')
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    errors.push('Must contain a number')
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push('Must contain a symbol (e.g. ! @ # $)')
  }

  return errors
}
