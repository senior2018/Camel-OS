import { consola } from 'consola'
import { desc, eq } from 'drizzle-orm'
import { projects } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireApiKey } from '@@/server/utils/api-key'

/** Public REST API (NT/API) — projects for the key's org. Auth: API key header. */
export default defineEventHandler(async (event) => {
  try {
    const { organizationId } = await requireApiKey(event)
    const items = await useDrizzle()
      .select({
        id: projects.id,
        name: projects.name,
        code: projects.code,
        status: projects.status,
        startDate: projects.startDate,
        endDate: projects.endDate,
      })
      .from(projects)
      .where(eq(projects.organizationId, organizationId))
      .orderBy(desc(projects.createdAt))
      .limit(200)
    return { data: items, count: items.length }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error in v1 projects', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
