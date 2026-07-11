import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { certifications } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** HR-07 — remove a certification record. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'hr', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    await useDrizzle()
      .delete(certifications)
      .where(and(eq(certifications.id, id), eq(certifications.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting certification', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
