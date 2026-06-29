import { consola } from 'consola'
import { and, desc, eq, ilike, or } from 'drizzle-orm'

import { melLessons, projects, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'

/** ME-05 — lessons library, searchable by text and sector. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'mel', 'read')
    const q = getQuery(event)
    const db = useDrizzle()

    const conds = [eq(melLessons.organizationId, ctx.organizationId)]
    if (q.q) {
      const like = `%${String(q.q)}%`
      conds.push(or(ilike(melLessons.title, like), ilike(melLessons.description, like))!)
    }
    if (q.sector) conds.push(eq(melLessons.sector, String(q.sector)))

    const rows = await db
      .select({
        id: melLessons.id,
        title: melLessons.title,
        description: melLessons.description,
        sector: melLessons.sector,
        tags: melLessons.tags,
        projectName: projects.name,
        authorFirstName: users.firstName,
        authorLastName: users.lastName,
        createdAt: melLessons.createdAt,
      })
      .from(melLessons)
      .leftJoin(projects, eq(projects.id, melLessons.projectId))
      .leftJoin(users, eq(users.id, melLessons.createdByUserId))
      .where(and(...conds))
      .orderBy(desc(melLessons.createdAt))

    const sectors = [...new Set(rows.map((r) => r.sector).filter((s): s is string => !!s))].sort()
    return { items: rows, sectors }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing lessons', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
