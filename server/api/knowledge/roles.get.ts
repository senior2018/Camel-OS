import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'
import { roles } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** Org roles for the knowledge access picker (KM-03). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'knowledge', 'update')
    const items = await useDrizzle()
      .select({ id: roles.id, name: roles.name })
      .from(roles)
      .where(eq(roles.organizationId, ctx.organizationId))
      .orderBy(asc(roles.name))
    return { items }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing roles', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
