import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'
import { releaseNotes } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'

/** HD-04 — release notes (everyone sees published; managers see drafts). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const canManage =
      ctx.isSystemAdmin || (await userHasPermission(ctx.userId, 'knowledge', 'update'))
    const where = canManage
      ? eq(releaseNotes.organizationId, ctx.organizationId)
      : and(eq(releaseNotes.organizationId, ctx.organizationId), eq(releaseNotes.published, true))
    const items = await useDrizzle()
      .select()
      .from(releaseNotes)
      .where(where)
      .orderBy(desc(releaseNotes.releasedAt))
    return { items, canManage }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing release notes', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
