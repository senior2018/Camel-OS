import { consola } from 'consola'
import { asc, eq } from 'drizzle-orm'
import { uatCases, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { DEFAULT_UAT_MODULES } from '@@/shared/schemas/launch'

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const db = useDrizzle()
    let rows = await db
      .select()
      .from(uatCases)
      .where(eq(uatCases.organizationId, ctx.organizationId))
      .orderBy(asc(uatCases.orderIndex))
    if (!rows.length) {
      await db.insert(uatCases).values(
        DEFAULT_UAT_MODULES.map((m, i) => ({
          organizationId: ctx.organizationId,
          module: m,
          title: `End-to-end smoke test — ${m}`,
          orderIndex: i,
        }))
      )
      rows = await db
        .select()
        .from(uatCases)
        .where(eq(uatCases.organizationId, ctx.organizationId))
        .orderBy(asc(uatCases.orderIndex))
    }
    const items = await db
      .select({ c: uatCases, testerFirst: users.firstName, testerLast: users.lastName })
      .from(uatCases)
      .leftJoin(users, eq(users.id, uatCases.testedByUserId))
      .where(eq(uatCases.organizationId, ctx.organizationId))
      .orderBy(asc(uatCases.orderIndex))
    return {
      items: items.map((r) => ({ ...r.c, testerFirst: r.testerFirst, testerLast: r.testerLast })),
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing UAT', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
