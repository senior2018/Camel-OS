import { consola } from 'consola'
import { z } from 'zod'
import { eq } from 'drizzle-orm'

import { useDrizzle } from '@@/server/utils/drizzle'
import { users } from '@@/server/database/schema'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * S5b — self-service profile edit. Only the fields a user is trusted to
 * update on their own: their own name. Email changes are admin-only because
 * the email is the login identifier; we don't want self-reset taking that
 * over without admin oversight. MFA-required toggles are admin-only too.
 */
const schema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const session = await getUserSession(event)
    if (!session.user) {
      throw createError({ statusCode: 401, statusMessage: 'Unauthorized' })
    }
    const sessionUser = session.user as { id: string }

    const parsed = schema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.firstName !== undefined) updates.firstName = parsed.data.firstName
    if (parsed.data.lastName !== undefined) updates.lastName = parsed.data.lastName

    const db = useDrizzle()
    const [updated] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, sessionUser.id))
      .returning()

    if (!updated) throw createError({ statusCode: 404, statusMessage: 'User not found' })

    // Sync the session so the UI reflects the new name immediately.
    await setUserSession(event, {
      user: {
        ...session.user,
        firstName: updated.firstName,
        lastName: updated.lastName,
      },
    })

    await logAuditEvent({
      organizationId: updated.organizationId,
      userId: updated.id,
      resource: 'user',
      action: 'profile_updated_self',
      resourceId: updated.id,
      meta: { fields: Object.keys(updates).filter((k) => k !== 'updatedAt') },
    })

    return { success: true, user: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating own profile', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
