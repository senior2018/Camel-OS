import { consola } from 'consola'

import { orgBudgets } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createBudgetSchema } from '@@/shared/schemas/finance'

/** FN-01 — create an annual organisational budget. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'finance', 'create')
    const body = await readValidatedBody(event, createBudgetSchema.parse)
    const [created] = await useDrizzle()
      .insert(orgBudgets)
      .values({
        organizationId: ctx.organizationId,
        fiscalYear: body.fiscalYear,
        name: body.name,
        currency: body.currency,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, budget: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    if ((error as { code?: string })?.code === '23505') {
      throw createError({
        statusCode: 409,
        statusMessage: 'A budget for that fiscal year already exists.',
      })
    }
    consola.error('Error creating budget', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
