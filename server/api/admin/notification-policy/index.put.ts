import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { notificationRolePolicy } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAdmin } from '@@/server/utils/admin-guard'
import { NOTIFICATION_CATEGORIES } from '@@/shared/schemas/notifications'

const schema = z.object({
  // category -> list of allowed role ids. An empty list clears the restriction.
  matrix: z.record(z.string(), z.array(z.string().uuid())),
})

/** NT-02 — replace the notification policy for one or more categories. */
export default defineEventHandler(async (event) => {
  try {
    const admin = await requireAdmin(event)
    const { matrix } = await readValidatedBody(event, schema.parse)
    const validKeys = new Set(NOTIFICATION_CATEGORIES.map((c) => c.key as string))
    const db = useDrizzle()

    for (const [category, roleIds] of Object.entries(matrix)) {
      if (!validKeys.has(category)) continue
      // Replace the whole set for this category.
      await db
        .delete(notificationRolePolicy)
        .where(
          and(
            eq(notificationRolePolicy.organizationId, admin.organizationId),
            eq(notificationRolePolicy.category, category)
          )
        )
      const unique = [...new Set(roleIds)]
      if (unique.length) {
        await db.insert(notificationRolePolicy).values(
          unique.map((roleId) => ({
            organizationId: admin.organizationId,
            category,
            roleId,
          }))
        )
      }
    }

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving notification policy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
