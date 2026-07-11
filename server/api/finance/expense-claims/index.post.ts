import { consola } from 'consola'

import { expenseClaims } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireUser } from '@@/server/utils/permission-guard'
import { createExpenseClaimSchema } from '@@/shared/schemas/finance'

/** FN-02 — a staff member files an expense claim (their own). */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireUser(event)
    const body = await readValidatedBody(event, createExpenseClaimSchema.parse)
    const [created] = await useDrizzle()
      .insert(expenseClaims)
      .values({
        organizationId: ctx.organizationId,
        claimantUserId: ctx.userId,
        title: body.title,
        category: body.category ?? null,
        amount: String(body.amount),
        currency: body.currency,
        incurredDate: body.incurredDate,
        projectId: body.projectId ?? null,
        receiptUrl: body.receiptUrl ? body.receiptUrl : null,
        status: 'draft',
      })
      .returning()
    return { success: true, claim: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating expense claim', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
