import { z } from 'zod'
import { consola } from 'consola'
import { eq } from 'drizzle-orm'

import { emailVerificationTokens, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { sha256 } from '@@/server/utils/crypto'
import { logAuditEvent } from '@@/server/utils/audit'

export default defineEventHandler(async (event) => {
  try {
    const schema = z.object({
      token: z.string().min(1, 'Token is required'),
    })

    const body = await readBody(event)
    const parsed = schema.safeParse(body)

    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid request payload' })
    }

    const tokenHash = sha256(parsed.data.token)
    const db = useDrizzle()
    const now = new Date()

    const [verifyToken] = await db
      .select()
      .from(emailVerificationTokens)
      .where(eq(emailVerificationTokens.tokenHash, tokenHash))
      .limit(1)

    if (!verifyToken || verifyToken.usedAt !== null || verifyToken.expiresAt < now) {
      throw createError({
        statusCode: 400,
        statusMessage: 'This verification link is invalid or has expired.',
      })
    }

    await db.transaction(async (tx) => {
      await tx
        .update(users)
        .set({ status: 'active', emailVerifiedAt: now })
        .where(eq(users.id, verifyToken.userId))

      await tx
        .update(emailVerificationTokens)
        .set({ usedAt: now })
        .where(eq(emailVerificationTokens.id, verifyToken.id))
    })

    const [user] = await db.select().from(users).where(eq(users.id, verifyToken.userId)).limit(1)

    if (user) {
      await logAuditEvent({
        organizationId: user.organizationId,
        userId: user.id,
        resource: 'auth',
        action: 'email_verified',
        meta: {},
      })
    }

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in verify-email', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
