import { consola } from 'consola'

import { organizationCommunicationsSettings } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { logAuditEvent } from '@@/server/utils/audit'
import { updateContentReviewPolicySchema } from '@@/shared/schemas/communication-settings'

/**
 * Upserts the org's content review policy. Editable by the communications
 * leader (communications:admin) or an org admin — the same gate as the rest of
 * the Settings page.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['communications', 'admin'],
      ['admin', 'admin'],
    ])

    const parsed = updateContentReviewPolicySchema.safeParse(await readBody(event))
    if (!parsed.success) {
      throw createError({
        statusCode: 400,
        statusMessage: parsed.error.issues[0]?.message ?? 'Invalid payload',
      })
    }
    const data = parsed.data
    const threshold = data.reviewRule === 'all' ? null : (data.reviewThreshold ?? null)

    await useDrizzle()
      .insert(organizationCommunicationsSettings)
      .values({
        organizationId: ctx.organizationId,
        reviewMinReviewers: data.reviewMinReviewers,
        reviewRule: data.reviewRule,
        reviewThreshold: threshold,
        requireFinalApprover: data.requireFinalApprover,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: organizationCommunicationsSettings.organizationId,
        set: {
          reviewMinReviewers: data.reviewMinReviewers,
          reviewRule: data.reviewRule,
          reviewThreshold: threshold,
          requireFinalApprover: data.requireFinalApprover,
          updatedAt: new Date(),
        },
      })

    await logAuditEvent({
      organizationId: ctx.organizationId,
      userId: ctx.userId,
      resource: 'communications',
      action: 'update',
      meta: { event: 'review_policy_updated', ...data },
    })

    return { success: true }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error saving content review policy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
