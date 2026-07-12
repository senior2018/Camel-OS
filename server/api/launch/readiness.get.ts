import { consola } from 'consola'
import { and, eq, ne, sql } from 'drizzle-orm'
import { feedbackItems, launchTasks, uatCases } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'

/** S30 — the go-live readiness score across UAT, checklist and open feedback. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [['admin', 'admin']])
    const db = useDrizzle()
    const [uat] = await db
      .select({
        total: sql<number>`count(*)::int`,
        pass: sql<number>`(count(*) filter (where ${uatCases.status} = 'pass'))::int`,
        fail: sql<number>`(count(*) filter (where ${uatCases.status} = 'fail'))::int`,
        blocked: sql<number>`(count(*) filter (where ${uatCases.status} = 'blocked'))::int`,
      })
      .from(uatCases)
      .where(eq(uatCases.organizationId, ctx.organizationId))
    const [tasks] = await db
      .select({
        total: sql<number>`count(*)::int`,
        done: sql<number>`(count(*) filter (where ${launchTasks.done}))::int`,
      })
      .from(launchTasks)
      .where(eq(launchTasks.organizationId, ctx.organizationId))
    const [fb] = await db
      .select({ open: sql<number>`count(*)::int` })
      .from(feedbackItems)
      .where(
        and(
          eq(feedbackItems.organizationId, ctx.organizationId),
          ne(feedbackItems.status, 'resolved'),
          ne(feedbackItems.status, 'wont_fix')
        )
      )

    const uatTotal = uat?.total ?? 0
    const tasksTotal = tasks?.total ?? 0
    const uatScore = uatTotal ? uat!.pass / uatTotal : 0
    const tasksScore = tasksTotal ? tasks!.done / tasksTotal : 0
    // Readiness = 60% checklist + 40% UAT pass, penalised by open bugs.
    const readiness = Math.round(Math.max(0, (tasksScore * 0.6 + uatScore * 0.4) * 100))
    return {
      readiness,
      uat: {
        total: uatTotal,
        pass: uat?.pass ?? 0,
        fail: uat?.fail ?? 0,
        blocked: uat?.blocked ?? 0,
      },
      tasks: { total: tasksTotal, done: tasks?.done ?? 0 },
      openFeedback: fb?.open ?? 0,
    }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error building readiness', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
