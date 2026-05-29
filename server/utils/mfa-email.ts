import { randomInt } from 'node:crypto'
import { and, eq, gt, isNull } from 'drizzle-orm'

import { mfaEmailCodes, users } from '../database/schema'
import { useDrizzle } from './drizzle'
import { sha256 } from './crypto'
import { sendMfaEmailCode } from './mailer'

/**
 * S5b — email-based second factor.
 *
 * `dispatchEmailCode` generates a fresh 6-digit code, stores its sha256 hash
 * with a 5-min TTL, invalidates any older un-consumed codes, and emails it.
 * `verifyEmailCode` consumes the most-recent valid code, returns true on
 * success. Both functions are intentionally tiny — the API endpoints handle
 * audit logging + rate limiting around them.
 */
const CODE_TTL_MS = 5 * 60 * 1000
const MAX_ATTEMPTS = 5

export async function dispatchEmailCode(userId: string): Promise<void> {
  const db = useDrizzle()

  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1)
  if (!user) throw new Error('User not found')

  // 6-digit code with no leading-zero issue (randomInt is bounded).
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0')
  const codeHash = sha256(code)

  await db.transaction(async (tx) => {
    // Invalidate every prior un-consumed code so the latest one is the only
    // candidate when verifying — prevents replay of stale codes.
    await tx
      .update(mfaEmailCodes)
      .set({ consumedAt: new Date() })
      .where(and(eq(mfaEmailCodes.userId, userId), isNull(mfaEmailCodes.consumedAt)))

    await tx.insert(mfaEmailCodes).values({
      userId,
      codeHash,
      expiresAt: new Date(Date.now() + CODE_TTL_MS),
    })
  })

  await sendMfaEmailCode(user.email, { code, expiresInMinutes: 5 })
}

export interface VerifyResult {
  ok: boolean
  reason?: 'invalid' | 'expired' | 'exhausted'
}

export async function verifyEmailCode(userId: string, code: string): Promise<VerifyResult> {
  const db = useDrizzle()
  const codeHash = sha256(code.trim())
  const now = new Date()

  const [row] = await db
    .select()
    .from(mfaEmailCodes)
    .where(
      and(
        eq(mfaEmailCodes.userId, userId),
        isNull(mfaEmailCodes.consumedAt),
        gt(mfaEmailCodes.expiresAt, now)
      )
    )
    .orderBy(mfaEmailCodes.createdAt)
    .limit(1)

  if (!row) return { ok: false, reason: 'expired' }
  if (row.attempts >= MAX_ATTEMPTS) return { ok: false, reason: 'exhausted' }

  if (row.codeHash !== codeHash) {
    await db
      .update(mfaEmailCodes)
      .set({ attempts: row.attempts + 1 })
      .where(eq(mfaEmailCodes.id, row.id))
    return { ok: false, reason: 'invalid' }
  }

  await db.update(mfaEmailCodes).set({ consumedAt: now }).where(eq(mfaEmailCodes.id, row.id))
  return { ok: true }
}
