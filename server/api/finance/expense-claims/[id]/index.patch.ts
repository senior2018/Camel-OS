import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { expenseClaims } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'
import { expenseClaimDecisionSchema } from '@@/shared/schemas/finance'

const bodySchema = z.union([z.object({ action: z.literal('submit') }), expenseClaimDecisionSchema])

/**
 * FN-02 — claimant submits their draft; finance approves / rejects / marks paid.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Id required' })
    const body = await readValidatedBody(event, bodySchema.parse)
    const db = useDrizzle()

    const [claim] = await db
      .select()
      .from(expenseClaims)
      .where(and(eq(expenseClaims.id, id), eq(expenseClaims.organizationId, ctx.organizationId)))
      .limit(1)
    if (!claim) throw createError({ statusCode: 404, statusMessage: 'Claim not found' })

    if ('action' in body) {
      if (claim.claimantUserId !== ctx.userId)
        throw createError({ statusCode: 403, statusMessage: 'Not your claim.' })
      if (claim.status !== 'draft')
        throw createError({ statusCode: 409, statusMessage: 'Only a draft can be submitted.' })
      await db
        .update(expenseClaims)
        .set({ status: 'submitted', submittedAt: new Date() })
        .where(eq(expenseClaims.id, id))
      return { success: true, status: 'submitted' }
    }

    const isFinance =
      ctx.isSystemAdmin || (await userHasPermission(ctx.userId, 'finance', 'update'))
    if (!isFinance) throw createError({ statusCode: 403, statusMessage: 'Finance role required.' })
    await db
      .update(expenseClaims)
      .set({
        status: body.decision,
        decisionNote: body.decisionNote ?? null,
        reviewedByUserId: ctx.userId,
        reviewedAt: new Date(),
        paidAt: body.decision === 'paid' ? new Date() : claim.paidAt,
      })
      .where(eq(expenseClaims.id, id))
    return { success: true, status: body.decision }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating expense claim', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
