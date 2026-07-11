import { consola } from 'consola'
import { rfqs } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { createRfqSchema } from '@@/shared/schemas/procurement'

/** PR-03 — issue an RFQ to invited vendors. */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'procurement', 'create')
    const b = await readValidatedBody(event, createRfqSchema.parse)
    const [created] = await useDrizzle()
      .insert(rfqs)
      .values({
        organizationId: ctx.organizationId,
        title: b.title,
        description: b.description ?? null,
        dueDate: b.dueDate || null,
        invitedVendors: b.invitedVendors,
        createdByUserId: ctx.userId,
      })
      .returning()
    return { success: true, rfq: created }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error creating RFQ', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
