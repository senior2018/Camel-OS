import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'
import { z } from 'zod'

import { opportunities } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requirePermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'

/**
 * OM-08 — Mark an opportunity as "Approved to Pursue" or revoke the approval.
 *
 * The schema already carries `approvedToPursueAt` + `approvedByUserId`; this
 * endpoint just flips them atomically and records who/when. Gated on
 * `opportunity:update` (we don't carve a separate `:approve` permission for
 * MVP — admins extend the role if they need finer control later).
 */
const bodySchema = z.object({
  approved: z.boolean(),
})

export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'opportunity', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Opportunity id is required' })

    const parsed = bodySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({ statusCode: 400, statusMessage: 'Invalid approval payload' })
    }

    const now = new Date()
    const [updated] = await useDrizzle()
      .update(opportunities)
      .set({
        approvedToPursueAt: parsed.data.approved ? now : null,
        approvedByUserId: parsed.data.approved ? ctx.userId : null,
        updatedAt: now,
      })
      .where(and(eq(opportunities.id, id), eq(opportunities.organizationId, ctx.organizationId)))
      .returning()

    if (!updated) {
      throw createError({ statusCode: 404, statusMessage: 'Opportunity not found' })
    }

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'opportunity',
      action: parsed.data.approved ? 'approved' : 'approval_revoked',
      resourceId: updated.id,
      meta: { title: updated.title },
    })

    return { success: true, opportunity: updated }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error toggling opportunity approval', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
