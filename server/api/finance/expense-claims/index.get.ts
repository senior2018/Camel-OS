import { consola } from 'consola'
import { and, desc, eq } from 'drizzle-orm'

import { expenseClaims, projects, users } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'

/** FN-02 — expense claims. Staff see their own; finance sees all. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const db = useDrizzle()
    const isFinance = ctx.isSystemAdmin || (await userHasPermission(ctx.userId, 'finance', 'read'))
    const where = isFinance
      ? eq(expenseClaims.organizationId, ctx.organizationId)
      : and(
          eq(expenseClaims.organizationId, ctx.organizationId),
          eq(expenseClaims.claimantUserId, ctx.userId)
        )
    const items = await db
      .select({
        id: expenseClaims.id,
        title: expenseClaims.title,
        category: expenseClaims.category,
        amount: expenseClaims.amount,
        currency: expenseClaims.currency,
        incurredDate: expenseClaims.incurredDate,
        status: expenseClaims.status,
        receiptUrl: expenseClaims.receiptUrl,
        decisionNote: expenseClaims.decisionNote,
        projectId: expenseClaims.projectId,
        projectName: projects.name,
        claimantUserId: expenseClaims.claimantUserId,
        claimantFirstName: users.firstName,
        claimantLastName: users.lastName,
        createdAt: expenseClaims.createdAt,
      })
      .from(expenseClaims)
      .leftJoin(projects, eq(projects.id, expenseClaims.projectId))
      .leftJoin(users, eq(users.id, expenseClaims.claimantUserId))
      .where(where)
      .orderBy(desc(expenseClaims.createdAt))
    return { items, canManage: isFinance }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error listing expense claims', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
