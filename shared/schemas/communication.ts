import { z } from 'zod'

/**
 * Shared validation + display vocabulary for the Communications module (S7).
 * Used on both client and server. Content lifecycle:
 *   draft → in_review → (changes_requested ↺) → approved → published → archived
 */

export const CONTENT_STATUSES = [
  'draft',
  'in_review',
  'changes_requested',
  'approved',
  'published',
  'archived',
] as const
export type ContentStatus = (typeof CONTENT_STATUSES)[number]

export const CONTENT_STATUS_LABEL: Record<ContentStatus, string> = {
  draft: 'Draft',
  in_review: 'In Review',
  changes_requested: 'Changes Requested',
  approved: 'Approved',
  published: 'Published',
  archived: 'Archived',
}

export type BadgeColor = 'neutral' | 'info' | 'warning' | 'success' | 'primary' | 'error'
export const CONTENT_STATUS_COLOR: Record<ContentStatus, BadgeColor> = {
  draft: 'neutral',
  in_review: 'info',
  changes_requested: 'warning',
  approved: 'success',
  published: 'primary',
  archived: 'neutral',
}

// Content type labels — plain strings in the DB so admins can extend later.
export const CONTENT_TYPES = ['insight', 'report', 'article', 'news', 'blog'] as const
export type ContentType = (typeof CONTENT_TYPES)[number]
export const CONTENT_TYPE_LABEL: Record<ContentType, string> = {
  insight: 'Insight',
  report: 'Report',
  article: 'Article',
  news: 'News',
  blog: 'Blog',
}

export const CONTENT_REVIEW_DECISIONS = [
  'pending',
  'approved',
  'changes_requested',
  'rejected',
] as const
export type ContentReviewDecision = (typeof CONTENT_REVIEW_DECISIONS)[number]

// ── Payloads ────────────────────────────────────────────────────────────────

export const createContentSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  type: z.string().trim().min(1).max(40).default('insight'),
  category: z.string().trim().max(80).nullish(),
  excerpt: z.string().trim().max(500).nullish(),
  body: z.string().nullish(),
  coverImageUrl: z.string().trim().url().max(2000).nullish(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
})
export type CreateContentPayload = z.infer<typeof createContentSchema>

export const updateContentSchema = createContentSchema.partial().extend({
  // CC-04 / CC-10 — planned publish date (ISO or yyyy-mm-dd) + campaign link.
  scheduledFor: z.string().trim().min(1).nullish(),
  campaignId: z.string().uuid().nullish(),
})
export type UpdateContentPayload = z.infer<typeof updateContentSchema>

// CC-02 — assign an ordered set of named reviewers (the approval workflow).
export const assignReviewersSchema = z.object({
  reviewers: z
    .array(
      z.object({
        userId: z.string().uuid(),
        stepOrder: z.number().int().min(1).max(20).default(1),
      })
    )
    .min(1, 'Add at least one reviewer')
    .max(20),
})
export type AssignReviewersPayload = z.infer<typeof assignReviewersSchema>

// CC-03 — a reviewer's decision; a comment is required unless approving.
export const reviewDecisionSchema = z
  .object({
    decision: z.enum(['approved', 'changes_requested', 'rejected']),
    comment: z.string().trim().max(2000).nullish(),
  })
  .refine((d) => d.decision === 'approved' || !!d.comment?.trim(), {
    message: 'A comment is required when requesting changes or rejecting',
    path: ['comment'],
  })
export type ReviewDecisionPayload = z.infer<typeof reviewDecisionSchema>

export const contentCommentSchema = z.object({
  body: z.string().trim().min(1).max(4000),
})
export type ContentCommentPayload = z.infer<typeof contentCommentSchema>

// CC-07 — staff library search/filter.
export const librarySearchSchema = z.object({
  q: z.string().trim().max(200).optional(),
  category: z.string().trim().max(80).optional(),
  author: z.string().uuid().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
})
export type LibrarySearchPayload = z.infer<typeof librarySearchSchema>

// ── Campaigns (CC-09..13) ─────────────────────────────────────────────────────

export const CAMPAIGN_STATUSES = ['planning', 'active', 'closed'] as const
export type CampaignStatus = (typeof CAMPAIGN_STATUSES)[number]
export const CAMPAIGN_STATUS_LABEL: Record<CampaignStatus, string> = {
  planning: 'Planning',
  active: 'Active',
  closed: 'Closed',
}
export const CAMPAIGN_STATUS_COLOR: Record<CampaignStatus, BadgeColor> = {
  planning: 'neutral',
  active: 'info',
  closed: 'success',
}

export const createCampaignSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  objective: z.string().trim().max(2000).nullish(),
  audience: z.string().trim().max(500).nullish(),
  startDate: z.string().trim().min(1).nullish(),
  endDate: z.string().trim().min(1).nullish(),
  budgetPlanned: z.number().min(0).nullish(),
  currency: z.string().trim().length(3).default('USD'),
  ownerUserId: z.string().uuid().nullish(),
})
export type CreateCampaignPayload = z.infer<typeof createCampaignSchema>

export const updateCampaignSchema = createCampaignSchema.partial().extend({
  status: z.enum(CAMPAIGN_STATUSES).optional(),
})
export type UpdateCampaignPayload = z.infer<typeof updateCampaignSchema>

// CC-12 — replace the full set of budget lines for a campaign.
export const campaignBudgetSchema = z.object({
  lines: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(160),
        plannedAmount: z.number().min(0).default(0),
        actualAmount: z.number().min(0).default(0),
      })
    )
    .max(100),
})
export type CampaignBudgetPayload = z.infer<typeof campaignBudgetSchema>

// CC-13 — close a campaign with a final report.
export const closeCampaignSchema = z.object({
  reportSummary: z.string().trim().min(1, 'A closing summary is required').max(5000),
})
export type CloseCampaignPayload = z.infer<typeof closeCampaignSchema>

// ── Content engagement metrics (CC-08) ────────────────────────────────────────
export const contentMetricSchema = z.object({
  metricDate: z.string().trim().min(1),
  impressions: z.number().int().min(0).default(0),
  clicks: z.number().int().min(0).default(0),
  shares: z.number().int().min(0).default(0),
  likes: z.number().int().min(0).default(0),
})
export type ContentMetricPayload = z.infer<typeof contentMetricSchema>

// ── Stakeholders (CC-14..17) ──────────────────────────────────────────────────
export const STAKEHOLDER_LEVELS = ['high', 'medium', 'low'] as const
export type StakeholderLevel = (typeof STAKEHOLDER_LEVELS)[number]
export const STAKEHOLDER_LEVEL_LABEL: Record<StakeholderLevel, string> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
}

// CC-15 — a deliberate engagement posture per quadrant of the matrix.
export const ENGAGEMENT_STRATEGIES = [
  'Manage closely',
  'Keep satisfied',
  'Keep informed',
  'Monitor',
] as const

export const STAKEHOLDER_TYPES = [
  'Government',
  'Donor',
  'Partner',
  'Media',
  'Community',
  'Private Sector',
  'Academia',
  'Other',
] as const

export const createStakeholderSchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  type: z.string().trim().max(80).nullish(),
  sector: z.string().trim().max(80).nullish(),
  geography: z.string().trim().max(80).nullish(),
  influence: z.enum(STAKEHOLDER_LEVELS).default('medium'),
  interest: z.enum(STAKEHOLDER_LEVELS).default('medium'),
  engagementStrategy: z.string().trim().max(160).nullish(),
  ownerUserId: z.string().uuid().nullish(),
})
export type CreateStakeholderPayload = z.infer<typeof createStakeholderSchema>

export const updateStakeholderSchema = createStakeholderSchema.partial()
export type UpdateStakeholderPayload = z.infer<typeof updateStakeholderSchema>

export const stakeholderActivitySchema = z.object({
  activityDate: z.string().trim().min(1),
  type: z.string().trim().min(1).max(60),
  description: z.string().trim().max(2000).nullish(),
  outcome: z.string().trim().max(2000).nullish(),
  nextStep: z.string().trim().max(1000).nullish(),
})
export type StakeholderActivityPayload = z.infer<typeof stakeholderActivitySchema>

// ── Media monitoring (CC-18/20/21) ────────────────────────────────────────────
export const MEDIA_SENTIMENTS = ['positive', 'neutral', 'negative'] as const
export type MediaSentiment = (typeof MEDIA_SENTIMENTS)[number]
export const MEDIA_SENTIMENT_LABEL: Record<MediaSentiment, string> = {
  positive: 'Positive',
  neutral: 'Neutral',
  negative: 'Negative',
}
export const MEDIA_SENTIMENT_COLOR: Record<MediaSentiment, BadgeColor> = {
  positive: 'success',
  neutral: 'neutral',
  negative: 'error',
}

export const MEDIA_SOURCE_TYPES = ['print', 'online', 'tv', 'radio', 'social'] as const
export type MediaSourceType = (typeof MEDIA_SOURCE_TYPES)[number]
export const MEDIA_SOURCE_TYPE_LABEL: Record<MediaSourceType, string> = {
  print: 'Print',
  online: 'Online',
  tv: 'TV',
  radio: 'Radio',
  social: 'Social',
}

export const createMediaMentionSchema = z.object({
  title: z.string().trim().min(1, 'Headline is required').max(300),
  outlet: z.string().trim().max(160).nullish(),
  sourceType: z.enum(MEDIA_SOURCE_TYPES).default('online'),
  sentiment: z.enum(MEDIA_SENTIMENTS).default('neutral'),
  url: z.string().trim().url().max(2000).nullish().or(z.literal('')),
  mentionDate: z.string().trim().min(1),
  summary: z.string().trim().max(2000).nullish(),
})
export type CreateMediaMentionPayload = z.infer<typeof createMediaMentionSchema>

// CC-21 — flag a mention for escalation (note required).
export const flagMentionSchema = z.object({
  escalationNote: z.string().trim().min(1, 'An escalation note is required').max(2000),
})
export type FlagMentionPayload = z.infer<typeof flagMentionSchema>
