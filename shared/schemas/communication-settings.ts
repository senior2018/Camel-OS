import { z } from 'zod'

/**
 * Configurable communications vocabularies (CC settings). These reuse the
 * generic `crm_lookup_values` table via distinct `kind` values, so a
 * communications leader (or an admin) can extend the content-type and category
 * pickers without a code change. Content *statuses* are deliberately NOT here —
 * they drive the review/publish state machine and must stay fixed.
 */
export const CONTENT_LOOKUP_KINDS = ['content_type', 'content_category'] as const
export type ContentLookupKind = (typeof CONTENT_LOOKUP_KINDS)[number]

export const CONTENT_LOOKUP_KIND_LABEL: Record<ContentLookupKind, string> = {
  content_type: 'Content type',
  content_category: 'Category / source tag',
}

export const createContentLookupSchema = z.object({
  kind: z.enum(CONTENT_LOOKUP_KINDS),
  key: z
    .string()
    .trim()
    .min(1, 'Key is required')
    .max(60)
    .regex(/^[a-z0-9_]+$/, 'Use lowercase letters, numbers, and underscores'),
  label: z.string().trim().min(1, 'Label is required').max(100),
  sortOrder: z.number().int().optional(),
})
export type CreateContentLookupPayload = z.output<typeof createContentLookupSchema>

export const updateContentLookupSchema = z.object({
  label: z.string().trim().min(1).max(100).optional(),
  sortOrder: z.number().int().optional(),
  archived: z.boolean().optional(),
})
export type UpdateContentLookupPayload = z.output<typeof updateContentLookupSchema>

/**
 * C2 — configurable social platforms and, per platform, the performance metrics
 * captured for a published post. Fully org-editable so the campaign entry form
 * adapts to each platform. Nothing here is hard-coded.
 */
export const DEFAULT_PLATFORMS = [
  'Facebook',
  'X (Twitter)',
  'LinkedIn',
  'Instagram',
  'YouTube',
  'Website / Blog',
]
export const DEFAULT_PLATFORM_METRICS: Record<string, string[]> = {
  Facebook: ['Reach', 'Impressions', 'Engagements', 'Clicks', 'Shares', 'Reactions'],
  'X (Twitter)': ['Impressions', 'Engagements', 'Retweets', 'Likes', 'Link clicks'],
  LinkedIn: ['Impressions', 'Clicks', 'Reactions', 'Comments', 'Shares'],
  Instagram: ['Reach', 'Impressions', 'Likes', 'Comments', 'Saves'],
  YouTube: ['Views', 'Watch time (min)', 'Likes', 'Comments', 'Subscribers gained'],
  'Website / Blog': ['Visits', 'Unique visitors', 'Avg. time (s)', 'Registrations'],
}

export interface CommunicationsSettings {
  platforms: string[]
  platformMetrics: Record<string, string[]>
}
export const DEFAULT_COMMUNICATIONS_SETTINGS: CommunicationsSettings = {
  platforms: [...DEFAULT_PLATFORMS],
  platformMetrics: structuredClone(DEFAULT_PLATFORM_METRICS),
}

export const updateCommunicationsSettingsSchema = z.object({
  platforms: z.array(z.string().trim().min(1).max(60)).min(1).max(30),
  platformMetrics: z.record(z.string(), z.array(z.string().trim().min(1).max(60)).max(30)),
})
export type UpdateCommunicationsSettingsPayload = z.output<
  typeof updateCommunicationsSettingsSchema
>

// C1/C2 — publishing + performance fields set on a content item once it's live.
export const contentPublishSchema = z.object({
  platform: z.string().trim().max(60).nullish(),
  publishedUrl: z.string().trim().url().max(2000).nullish().or(z.literal('')),
  isPaid: z.boolean().optional(),
  spend: z.number().min(0).optional(),
  metrics: z.record(z.string(), z.number().min(0)).optional(),
})
export type ContentPublishPayload = z.output<typeof contentPublishSchema>

/**
 * Content review policy (CC — mirrors the proposal review policy). Reviewers
 * read, comment, and approve; the policy decides how many approvals are needed
 * before a content item is ready for the final approver (the Communications
 * Lead) to publish.
 */
export const CONTENT_REVIEW_RULES = ['all', 'count', 'percent'] as const
export type ContentReviewRule = (typeof CONTENT_REVIEW_RULES)[number]

export const CONTENT_REVIEW_RULE_LABEL: Record<ContentReviewRule, string> = {
  all: 'Every assigned reviewer must approve',
  count: 'At least N reviewers must approve',
  percent: 'A percentage of reviewers must approve',
}

export interface ContentReviewPolicy {
  reviewMinReviewers: number
  reviewRule: ContentReviewRule
  reviewThreshold: number | null
  requireFinalApprover: boolean
}

export const DEFAULT_CONTENT_REVIEW_POLICY: ContentReviewPolicy = {
  reviewMinReviewers: 1,
  reviewRule: 'all',
  reviewThreshold: null,
  requireFinalApprover: true,
}

export const updateContentReviewPolicySchema = z
  .object({
    reviewMinReviewers: z.number().int().min(1).max(20),
    reviewRule: z.enum(CONTENT_REVIEW_RULES),
    reviewThreshold: z.number().int().min(1).max(100).nullish(),
    requireFinalApprover: z.boolean(),
  })
  .refine((v) => v.reviewRule === 'all' || (v.reviewThreshold ?? 0) >= 1, {
    message: 'A threshold is required for this rule.',
    path: ['reviewThreshold'],
  })
export type UpdateContentReviewPolicyPayload = z.output<typeof updateContentReviewPolicySchema>

/**
 * Given the reviewer decisions and a policy, decide whether the content has
 * gathered enough approvals. Shared so the API and any UI preview agree.
 */
export function contentApprovalMet(
  decisions: { decision: string }[],
  policy: ContentReviewPolicy
): boolean {
  const total = decisions.length
  if (total === 0) return false
  const approvals = decisions.filter((d) => d.decision === 'approved').length
  if (policy.reviewRule === 'count') return approvals >= (policy.reviewThreshold ?? total)
  if (policy.reviewRule === 'percent') {
    return (approvals / total) * 100 >= (policy.reviewThreshold ?? 100)
  }
  return approvals === total
}
