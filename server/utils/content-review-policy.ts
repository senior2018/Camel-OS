import { eq } from 'drizzle-orm'

import { organizationCommunicationsSettings } from '@@/server/database/schema'
import { useDrizzle } from '@@/server/utils/drizzle'
import {
  CONTENT_REVIEW_RULES,
  DEFAULT_CONTENT_REVIEW_POLICY,
  type ContentReviewPolicy,
  type ContentReviewRule,
} from '@@/shared/schemas/communication-settings'

/**
 * The org's content review policy, falling back to the shipped defaults when no
 * row exists. Read by send-for-review, the review tally, and publish so the
 * whole workflow honours the same rules.
 */
export async function getContentReviewPolicy(organizationId: string): Promise<ContentReviewPolicy> {
  const [row] = await useDrizzle()
    .select()
    .from(organizationCommunicationsSettings)
    .where(eq(organizationCommunicationsSettings.organizationId, organizationId))
    .limit(1)

  if (!row) return { ...DEFAULT_CONTENT_REVIEW_POLICY }

  const rule = (
    CONTENT_REVIEW_RULES.includes(row.reviewRule as ContentReviewRule) ? row.reviewRule : 'all'
  ) as ContentReviewRule

  return {
    reviewMinReviewers: row.reviewMinReviewers,
    reviewRule: rule,
    reviewThreshold: row.reviewThreshold,
    requireFinalApprover: row.requireFinalApprover,
  }
}
