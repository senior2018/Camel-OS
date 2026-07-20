import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'
import { launchTasks } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { DEFAULT_LAUNCH_TASKS } from '@@/shared/schemas/launch'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const db = useDrizzle()
    let rows = await db
      .select()
      .from(launchTasks)
      .where(eq(launchTasks.organizationId, ctx.organizationId))
      .orderBy(asc(launchTasks.orderIndex))
    if (!rows.length) {
      await db.insert(launchTasks).values(
        DEFAULT_LAUNCH_TASKS.map((t, i) => ({
          organizationId: ctx.organizationId,
          category: t.category,
          label: t.label,
          orderIndex: i,
        }))
      )
      rows = await db
        .select()
        .from(launchTasks)
        .where(eq(launchTasks.organizationId, ctx.organizationId))
        .orderBy(asc(launchTasks.orderIndex))
    }
    return { items: rows }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error(error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
