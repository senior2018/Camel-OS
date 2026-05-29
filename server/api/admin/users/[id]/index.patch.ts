import { consola } from 'consola'
import { z } from 'zod'
import { and, eq } from 'drizzle-orm'

import { useDrizzle } from '@@/server/utils/drizzle'
import { users } from '@@/server/database/schema'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * S5b — admins can edit user profile basics (name, email, MFA-required flag).
 * Role changes still go through `/api/admin/users/[id]/roles`, and password
 * resets go through the existing reset-token flow. Email changes are taken at
 * face value — the workflow already covers re-verification on next login if
 * we choose to wire it later.
 *
 * Super-admin protection: a non-super admin cannot edit the super admin's
 * profile. The super admin can edit any user, including themselves.
 */
const schema = z.object({
  firstName: z.string().trim().min(1).max(100).optional(),
  lastName: z.string().trim().min(1).max(100).optional(),
  email: z.string().trim().toLowerCase().email().max(200).optional(),
  mfaRequired: z.boolean().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const targetId = getRouterParam(event, 'id')
    if (!targetId) throw createError({ statusCode: 400, statusMessage: 'User id required' })

    const parsed = schema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }

    const db = useDrizzle()
    const [target] = await db
      .select()
      .from(users)
      .where(and(eq(users.id, targetId), eq(users.organizationId, admin.organizationId)))
      .limit(1)
    if (!target) throw createError({ statusCode: 404, statusMessage: 'User not found' })

    // Super-admin shield: only the super admin themselves can edit the super
    // admin's record. Other admins can read but not mutate.
    if (target.isSuperAdmin && admin.userId !== target.id) {
      throw createError({
        statusCode: 403,
        statusMessage: "You cannot edit the super admin's profile.",
      })
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() }
    if (parsed.data.firstName !== undefined) updates.firstName = parsed.data.firstName
    if (parsed.data.lastName !== undefined) updates.lastName = parsed.data.lastName
    if (parsed.data.email !== undefined) updates.email = parsed.data.email
    if (parsed.data.mfaRequired !== undefined) updates.mfaRequired = parsed.data.mfaRequired

    const [updated] = await db.update(users).set(updates).where(eq(users.id, targetId)).returning()
    if (!updated) throw new Error('Update failed')

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'user',
      action: 'profile_updated_by_admin',
      resourceId: targetId,
      meta: {
        fields: Object.keys(updates).filter((k) => k !== 'updatedAt'),
        targetEmail: updated.email,
      },
    })

    return { success: true, user: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error editing user', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
