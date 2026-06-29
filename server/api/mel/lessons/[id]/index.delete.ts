import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { melLessons } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ME-05 — delete a lesson. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'ID is required' })
    await useDrizzle()
      .delete(melLessons)
      .where(and(eq(melLessons.id, id), eq(melLessons.organizationId, ctx.organizationId)))
    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error deleting lesson', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
