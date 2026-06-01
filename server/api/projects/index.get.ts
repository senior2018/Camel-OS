import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * CR-10 — Stub projects list, scoped to the caller's organization. Used by the
 * donor-project link picker. S13+ replaces this with the full project module.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'crm', 'read')
    const db = useDrizzle()

    const items = await db
      .select()
      .from(projects)
      .where(eq(projects.organizationId, ctx.organizationId))
      .orderBy(desc(projects.createdAt))

    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing projects', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
