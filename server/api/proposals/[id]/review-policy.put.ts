import { consola } from 'consola'
import { and, eq } from 'drizzle-orm'

import { proposals } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { logAuditEvent } from '@@/server/utils/audit'
import { isProposalLead } from '@@/server/utils/proposal-access'
import { requirePermission } from '@@/server/utils/permission-guard'
import { userHasPermission } from '@@/server/utils/role'
import { updateReviewPolicySchema } from '@@/shared/schemas/proposal'

/**
 * P3.3 — set the per-proposal review policy (min reviewers, approval rule +
 * threshold, whether a final approver is required). The Proposal Lead, a manager
 * (`proposal:admin`), or a system admin may change it.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requirePermission(event, 'proposal', 'update')
    const id = getRouterParam(event, 'id')
    if (!id) throw createError({ statusCode: 400, statusMessage: 'Proposal ID is required' })

    const payload = updateReviewPolicySchema.parse(await readBody(event))
    const db = useDrizzle()

    const [proposal] = await db
      .select({ id: proposals.id, opportunityId: proposals.opportunityId })
      .from(proposals)
      .where(and(eq(proposals.id, id), eq(proposals.organizationId, ctx.organizationId)))
      .limit(1)
    if (!proposal) throw createError({ statusCode: 404, statusMessage: 'Proposal not found' })

    const allowed =
      ctx.isSystemAdmin ||
      (await isProposalLead(id, ctx.userId, ctx.isSystemAdmin)) ||
      (await userHasPermission(ctx.userId, 'proposal', 'admin'))
    if (!allowed) {
      throw createError({
        statusCode: 403,
        statusMessage: 'Only the Proposal Lead or a manager can change the review policy',
      })
    }

    await db
      .update(proposals)
      .set({
        reviewMinReviewers: payload.reviewMinReviewers,
        reviewRule: payload.reviewRule,
        reviewThreshold: payload.reviewRule === 'all' ? null : (payload.reviewThreshold ?? null),
        requireFinalApprover: payload.requireFinalApprover,
        updatedAt: new Date(),
      })
      .where(eq(proposals.id, id))

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'proposal',
      action: 'review_policy_updated',
      resourceId: id,
      meta: { ...payload },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error updating review policy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
