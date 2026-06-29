import { randomUUID } from 'node:crypto'

import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/**
 * ME-06 — enable / rotate / disable the read-only donor portal share link.
 * Body `{ enable: boolean }`. Returns the token (null when disabled).
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'project', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Project ID is required' })
    const body = await readBody<{ enable?: boolean }>(event)
    const db = useDrizzle()

    const [project] = await db
      .select({ id: projects.id })
      .from(projects)
      .where(and(eq(projects.id, id), eq(projects.organizationId, ctx.organizationId)))
      .limit(1)
    if (!project) throw createError({ statusCode: 404, statusMessage: 'Project not found' })

    const token = body.enable === false ? null : `${randomUUID()}${randomUUID()}`.replace(/-/g, '')
    await db
      .update(projects)
      .set({ portalToken: token, updatedAt: new Date() })
      .where(eq(projects.id, id))
    return { success: true, portalToken: token }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error toggling portal', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
