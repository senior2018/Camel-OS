import { consola } from 'consola'

import { requireAnyPermission } from '@@/server/utils/permission-guard'
import { getContentReviewPolicy } from '@@/server/utils/content-review-policy'

/**
 * The org's content review policy. Readable by any content-team member so the
 * writing + review UI can show the rules (min reviewers, approval rule); it is
 * only editable on the Settings page by a leader/admin.
 */
export default defineEventHandler(async (event) => {
  try {
    const ctx = await requireAnyPermission(event, [
      ['communications', 'read'],
      ['communications', 'create'],
      ['communications', 'update'],
      ['communications', 'approve'],
    ])
    return { policy: await getContentReviewPolicy(ctx.organizationId) }
  } catch (error) {
    if (typeof error === 'object' && error !== null && 'statusCode' in error) throw error
    consola.error('Error loading content review policy', error)
    throw createError({ statusCode: 500, statusMessage: 'Internal server error' })
  }
})
