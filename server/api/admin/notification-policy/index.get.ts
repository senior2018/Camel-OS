import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'

import { notificationRolePolicy, roles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { NOTIFICATION_CATEGORIES } from '@@/shared/schemas/notifications'

/**
 * NT-02 — the role-level notification policy matrix. For each category we return
 * the set of role ids allowed to receive it. An empty set means "no restriction"
 * (everyone receives), which is the default when no rows exist.
 */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const db = useDrizzle()
    const [roleRows, policyRows] = await Promise.all([
      db
        .select({ id: roles.id, name: roles.name })
        .from(roles)
        .where(eq(roles.organizationId, admin.organizationId))
        .orderBy(asc(roles.name)),
      db
        .select({
          category: notificationRolePolicy.category,
          roleId: notificationRolePolicy.roleId,
        })
        .from(notificationRolePolicy)
        .where(eq(notificationRolePolicy.organizationId, admin.organizationId)),
    ])

    const matrix: Record<string, string[]> = {}
    for (const c of NOTIFICATION_CATEGORIES) matrix[c.key] = []
    for (const p of policyRows) {
      if (!matrix[p.category]) matrix[p.category] = []
      matrix[p.category]!.push(p.roleId)
    }

    return {
      categories: NOTIFICATION_CATEGORIES,
      roles: roleRows,
      matrix,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading notification policy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
