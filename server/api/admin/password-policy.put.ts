import { consola } from 'consola'
import { eq } from 'drizzle-orm'

import { passwordPolicies } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { getPasswordPolicy } from '@@/server/utils/password-policy'
import { passwordPolicySchema } from '@@/shared/schemas/password-policy'

export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)

    const parsed = passwordPolicySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid password policy payload' })
    }

    // Ensure a row exists, then update. `getPasswordPolicy` lazily seeds defaults.
    await getPasswordPolicy(admin.organizationId)

    const db = useDrizzle()
    await db
      .update(passwordPolicies)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(eq(passwordPolicies.organizationId, admin.organizationId))

    await logAuditEvent({
      organizationId: admin.organizationId,
      userId: admin.userId,
      resource: 'password_policy',
      action: 'update',
      resourceId: admin.organizationId,
      meta: { ...parsed.data },
    })

    return { success: true, policy: parsed.data }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating password policy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
